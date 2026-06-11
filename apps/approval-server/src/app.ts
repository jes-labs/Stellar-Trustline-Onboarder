import { timingSafeEqual } from 'node:crypto';
import { FeeBumpTransaction, type Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import {
  type ApprovalResult,
  buildClawback,
  buildFreeze,
  loadAccount,
  submit,
  toTransaction,
} from '@trustline-onboarder/core';
import { buildStellarToml, type OnboardingService } from '@trustline-onboarder/discovery';
import { LocalSigner } from '@trustline-onboarder/signer';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { ServerConfig } from './config';
import { ApprovalCache } from './idempotency';
import { decide, type KYCProvider, StoreKycProvider } from './kyc';
import { InMemoryStore, type KycStatus, type Store } from './store';
import { validateOnboardingTx } from './validate';
import { bearerToken, WebAuthService } from './web-auth';

export interface BuiltServer {
  app: FastifyInstance;
  signer: LocalSigner;
  store: Store;
  kyc: KYCProvider;
  webAuth: WebAuthService;
  approvals: ApprovalCache;
  config: ServerConfig;
  issuer: string;
}

export interface BuildServerDeps {
  /** Persistence. Defaults to an in-memory store; pass a PostgresStore in production. */
  store?: Store;
  /** KYC provider. Defaults to one backed by the store. */
  kyc?: KYCProvider;
}

const KYC_STATUSES: ReadonlySet<string> = new Set(['unknown', 'pending', 'approved', 'denied']);

/** Constant-time string comparison, to avoid leaking the admin token through timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Build the issuer-side approval server. It signs only issuer authorization and MiCA operations
 * (through the {@link LocalSigner}) and never holds or moves user funds. The factory returns the
 * Fastify instance plus the signer, store, and auth service so callers (and the demo) can drive
 * it in-process or over HTTP.
 */
export function buildServer(config: ServerConfig, deps: BuildServerDeps = {}): BuiltServer {
  const signer = new LocalSigner(config.issuerSecret);
  const store = deps.store ?? new InMemoryStore();
  const kyc = deps.kyc ?? new StoreKycProvider(store);
  const approvals = new ApprovalCache();
  const issuer = signer.publicKey();
  const webAuth = new WebAuthService({
    serverSecret: config.issuerSecret,
    network: config.network,
    homeDomain: config.homeDomain,
    webAuthDomain: config.webAuthDomain,
    jwtSecret: config.jwtSecret,
  });

  // A transaction envelope is small; cap the body so the signing endpoint cannot be flooded with
  // oversized payloads.
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });

  app.get('/health', async () => ({ status: 'ok' }));

  // Guard the admin endpoints, which sign issuer operations or change KYC state. Returns true if
  // authorized; otherwise it has already sent the appropriate error response.
  function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
    if (!config.adminToken) {
      reply.code(503).send({ error: 'admin_disabled' });
      return false;
    }
    const token = bearerToken(req.headers.authorization);
    if (!token || !safeEqual(token, config.adminToken)) {
      reply.code(401).send({ error: 'unauthorized' });
      return false;
    }
    return true;
  }

  // Resolve the authenticated account from a SEP-10 session token, or null.
  async function authenticate(req: FastifyRequest): Promise<string | null> {
    const token = bearerToken(req.headers.authorization);
    if (!token) return null;
    return webAuth.verifyToken(token);
  }

  // --- SEP-10 web auth -----------------------------------------------------
  app.get<{ Querystring: { account?: string } }>('/auth', async (req, reply) => {
    const account = req.query.account;
    if (!account) return reply.code(400).send({ error: 'missing_account' });
    try {
      const transaction = webAuth.buildChallenge(account);
      return reply.send({ transaction, network_passphrase: config.network });
    } catch (err) {
      return reply.code(400).send({ error: 'invalid_account', message: (err as Error).message });
    }
  });

  app.post<{ Body: { transaction?: string } }>('/auth', async (req, reply) => {
    const transaction = req.body?.transaction;
    if (!transaction) return reply.code(400).send({ error: 'missing_transaction' });
    try {
      const token = await webAuth.verifyChallenge(transaction);
      return reply.send({ token });
    } catch (err) {
      return reply.code(400).send({ error: 'invalid_challenge', message: (err as Error).message });
    }
  });

  // --- Discovery -----------------------------------------------------------
  // The onboarding service this issuer advertises, shared by /info and the stellar.toml so the
  // two never drift.
  const onboarding: OnboardingService = {
    server: '/tx-approve',
    mechanisms: ['claimable', 'authorize'],
    profiles: ['regulated', 'unregulated'],
  };

  app.get('/info', async () => ({
    issuer,
    network: config.network,
    assetCode: config.assetCode,
    mechanisms: onboarding.mechanisms,
    profiles: onboarding.profiles,
    endpoints: { approve: '/tx-approve', auth: '/auth', audit: '/audit' },
  }));

  app.get('/.well-known/stellar.toml', async (_req, reply) => {
    const toml = buildStellarToml({
      networkPassphrase: config.network,
      onboarding,
      currencies: [
        {
          code: config.assetCode,
          issuer,
          regulated: true,
          approvalServer: '/tx-approve',
          approvalCriteria: 'An authorized trustline is required before holding this asset.',
        },
      ],
    });
    reply.header('content-type', 'text/plain; charset=utf-8').send(toml);
  });

  // --- SEP-8-style approval ------------------------------------------------
  app.post<{ Body: { tx?: string } }>('/tx-approve', async (req, reply) => {
    // The endpoint applies the issuer signature, so it requires an authenticated caller.
    const account = await authenticate(req);
    if (!account) {
      return reply
        .code(401)
        .send({ status: 'rejected', error: 'unauthorized' } satisfies ApprovalResult);
    }

    const txXdr = req.body?.tx;
    if (!txXdr) {
      return reply
        .code(400)
        .send({ status: 'rejected', error: 'missing_tx' } satisfies ApprovalResult);
    }

    let parsed: Transaction | FeeBumpTransaction;
    try {
      parsed = TransactionBuilder.fromXDR(txXdr, config.network);
    } catch {
      return reply.send({ status: 'rejected', error: 'invalid_xdr' } satisfies ApprovalResult);
    }
    // The issuer never signs a fee-bump wrapper; only the inner onboarding transaction.
    if (parsed instanceof FeeBumpTransaction) {
      return reply.send({
        status: 'rejected',
        error: 'fee_bump_not_allowed',
      } satisfies ApprovalResult);
    }
    const tx = parsed;

    // Idempotency and replay protection: the same transaction always yields the same response,
    // and is never signed or audited twice. The hash is stable across signing.
    const txHash = tx.hash().toString('hex');
    const cached = approvals.get(txHash);
    if (cached) {
      return reply.send(cached);
    }

    const verdict = validateOnboardingTx(tx, issuer);
    if (!verdict.ok) {
      return reply.send(
        approvals.remember(txHash, {
          status: 'rejected',
          error: 'disallowed_transaction',
          message: verdict.reason,
        }),
      );
    }

    // KYC gate: every trustor the issuer is asked to authorize must be explicitly approved.
    // Fail-closed, and KYC outcomes are not cached so a later approval can succeed once the
    // holder completes KYC.
    for (const trustor of verdict.authorizedTrustors) {
      const decision = decide(await kyc.status(trustor));
      if (decision === 'rejected') {
        return reply.send({
          status: 'rejected',
          error: 'kyc_denied',
          message: `KYC denied for ${trustor}`,
        } satisfies ApprovalResult);
      }
      if (decision === 'action_required') {
        return reply.send({
          status: 'action_required',
          message: `KYC required before authorizing ${trustor}`,
        } satisfies ApprovalResult);
      }
    }

    // Nothing for the issuer to sign (unregulated): approve as-is.
    if (verdict.authorizedTrustors.length === 0) {
      return reply.send(approvals.remember(txHash, { status: 'success', tx: txXdr }));
    }

    // Apply the issuer authorization signature and record the durable trail.
    await signer.sign(tx);
    const mechanism = tx.operations.some((op) => op.type === 'claimClaimableBalance')
      ? 'claimable'
      : 'authorize';
    for (const trustor of verdict.authorizedTrustors) {
      await store.recordAuthorization({ account: trustor, assetCode: config.assetCode, mechanism });
      await store.appendAudit({ action: 'authorize', actor: issuer, subject: trustor });
    }
    if (verdict.sponsor && verdict.sponsoredAccount) {
      await store.recordSponsorship({
        account: verdict.sponsoredAccount,
        sponsor: verdict.sponsor,
        assetCode: config.assetCode,
      });
    }
    return reply.send(approvals.remember(txHash, { status: 'revised', tx: tx.toXDR() }));
  });

  // --- Admin / MiCA --------------------------------------------------------
  app.post<{ Body: { account?: string; status?: string } }>('/admin/kyc', async (req, reply) => {
    if (!requireAdmin(req, reply)) return reply;
    const { account, status } = req.body ?? {};
    if (!account || !status) return reply.code(400).send({ error: 'missing_account_or_status' });
    if (!KYC_STATUSES.has(status)) return reply.code(400).send({ error: 'invalid_status' });
    await store.setCustomerStatus(account, status as KycStatus);
    return reply.send({ status: 'ok' });
  });

  app.post<{ Body: { trustor: string; assetCode?: string; reason?: string } }>(
    '/admin/freeze',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return reply;
      const { trustor, assetCode, reason } = req.body ?? {};
      if (!trustor) return reply.code(400).send({ error: 'missing_trustor' });
      const asset = { code: assetCode ?? config.assetCode, issuer };
      const issuerAccount = await loadAccount(config.horizonUrl, issuer);
      const built = buildFreeze({ asset, trustor }, issuerAccount, config.network);
      const tx = toTransaction(built);
      await signer.sign(tx);
      const res = await submit(config.horizonUrl, tx);
      await store.appendAudit({ action: 'freeze', actor: issuer, subject: trustor, reason });
      return reply.send({ status: 'ok', hash: res.hash });
    },
  );

  app.post<{ Body: { from: string; amount: string; assetCode?: string; reason?: string } }>(
    '/admin/clawback',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return reply;
      const { from, amount, assetCode, reason } = req.body ?? {};
      if (!from || !amount) return reply.code(400).send({ error: 'missing_from_or_amount' });
      const asset = { code: assetCode ?? config.assetCode, issuer };
      const issuerAccount = await loadAccount(config.horizonUrl, issuer);
      const built = buildClawback({ asset, from, amount }, issuerAccount, config.network);
      const tx = toTransaction(built);
      await signer.sign(tx);
      const res = await submit(config.horizonUrl, tx);
      await store.appendAudit({ action: 'clawback', actor: issuer, subject: from, reason });
      return reply.send({ status: 'ok', hash: res.hash });
    },
  );

  app.get('/audit', async () => ({ entries: await store.auditLog() }));

  return { app, signer, store, kyc, webAuth, approvals, config, issuer };
}
