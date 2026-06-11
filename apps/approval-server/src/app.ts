import {
  type ApprovalResult,
  buildClawback,
  buildFreeze,
  loadAccount,
  parseTransaction,
  submit,
  toTransaction,
} from '@trustline-onboarder/core';
import { buildStellarToml, type OnboardingService } from '@trustline-onboarder/discovery';
import { LocalSigner } from '@trustline-onboarder/signer';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { Compliance } from './compliance';
import type { ServerConfig } from './config';
import { ApprovalCache } from './idempotency';
import { validateOnboardingTx } from './validate';

export interface BuiltServer {
  app: FastifyInstance;
  signer: LocalSigner;
  compliance: Compliance;
  approvals: ApprovalCache;
  config: ServerConfig;
  issuer: string;
}

/**
 * Build the issuer-side approval server. It signs only issuer authorization and MiCA operations
 * (through the {@link LocalSigner}) and never holds or moves user funds. The factory returns the
 * Fastify instance plus the signer and compliance state so callers (and the demo) can drive it
 * in-process or over HTTP.
 */
export function buildServer(config: ServerConfig): BuiltServer {
  const signer = new LocalSigner(config.issuerSecret);
  const compliance = new Compliance();
  const approvals = new ApprovalCache();
  const issuer = signer.publicKey();
  const app = Fastify({ logger: false });

  /**
   * Guard the admin endpoints, which sign issuer operations. Returns true if the request is
   * authorized; otherwise it has already sent the appropriate error response.
   */
  function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
    if (!config.adminToken) {
      reply.code(503).send({ error: 'admin_disabled' });
      return false;
    }
    const header = req.headers.authorization;
    if (header !== `Bearer ${config.adminToken}`) {
      reply.code(401).send({ error: 'unauthorized' });
      return false;
    }
    return true;
  }

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
    endpoints: { approve: '/tx-approve', audit: '/audit' },
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
    const txXdr = req.body?.tx;
    if (!txXdr) {
      return reply
        .code(400)
        .send({ status: 'rejected', error: 'missing_tx' } satisfies ApprovalResult);
    }

    let tx: ReturnType<typeof parseTransaction>;
    try {
      tx = parseTransaction(txXdr, config.network);
    } catch {
      return reply.send({ status: 'rejected', error: 'invalid_xdr' } satisfies ApprovalResult);
    }

    // Idempotency + replay protection: the same transaction always yields the same response, and
    // is never signed or audited twice. The hash is stable across signing.
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

    // Compliance gate: every trustor we're asked to authorize must be cleared. Not cached, so a
    // later approval can succeed once KYC completes.
    for (const trustor of verdict.authorizedTrustors) {
      if (!compliance.isApproved(trustor)) {
        return reply.send({
          status: 'action_required',
          message: `KYC required before authorizing ${trustor}`,
        } satisfies ApprovalResult);
      }
    }

    // Nothing for the issuer to sign (unregulated) — approve as-is.
    if (verdict.authorizedTrustors.length === 0) {
      return reply.send(approvals.remember(txHash, { status: 'success', tx: txXdr }));
    }

    // Apply the issuer authorization signature and record the audit trail.
    await signer.sign(tx);
    for (const trustor of verdict.authorizedTrustors) {
      compliance.record({ action: 'authorize', actor: issuer, subject: trustor });
    }
    return reply.send(approvals.remember(txHash, { status: 'revised', tx: tx.toXDR() }));
  });

  // --- Admin / MiCA --------------------------------------------------------
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
      compliance.record({ action: 'freeze', actor: issuer, subject: trustor, reason });
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
      compliance.record({ action: 'clawback', actor: issuer, subject: from, reason });
      return reply.send({ status: 'ok', hash: res.hash });
    },
  );

  app.get('/audit', async () => ({ entries: compliance.audit() }));

  return { app, signer, compliance, approvals, config, issuer };
}
