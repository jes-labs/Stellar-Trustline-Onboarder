/**
 * Phase 1 demo — Mechanism A, REGULATED (AUTH_REQUIRED) asset, end-to-end on Stellar testnet,
 * through the issuer-side approval server.
 *
 * "Hold before receiving": a user establishes a sponsored, issuer-authorized trustline before
 * any funds arrive, so a later withdrawal can settle with no trustline step. Proves the second
 * regulated flow (mechanism A) alongside the claimable-balance flow (mechanism C).
 *
 * Run:  pnpm demo:authorize
 */

import { Keypair, Operation } from '@stellar/stellar-sdk';
import { buildServer } from '@trustline-onboarder/approval-server/app';
import type { ServerConfig } from '@trustline-onboarder/approval-server/config';
import {
  type ApprovalResult,
  buildAuthorize,
  parseTransaction,
  toAsset,
} from '@trustline-onboarder/core';
import {
  assetBalance,
  friendbot,
  HORIZON_URL,
  load,
  logInfo,
  logOk,
  logStep,
  NETWORK,
  server,
  setRegulatedFlags,
  submitOps,
  xlmBalance,
} from './lib';

const PORT = 8789;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ADMIN_TOKEN = 'demo-admin-token';
const admin = { authorization: `Bearer ${ADMIN_TOKEN}` };

async function postJson<T>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  return (await (await fetch(`${BASE_URL}${path}`)).json()) as T;
}

/** Complete SEP-10: fetch a challenge, sign it, exchange it for a session token. */
async function authenticate(kp: Keypair): Promise<{ authorization: string }> {
  const { transaction } = await getJson<{ transaction: string }>(`/auth?account=${kp.publicKey()}`);
  const signed = parseTransaction(transaction, NETWORK);
  signed.sign(kp);
  const { token } = await postJson<{ token: string }>('/auth', { transaction: signed.toXDR() });
  return { authorization: `Bearer ${token}` };
}

async function main(): Promise<void> {
  console.log('\n=== Trustline Onboarder — Mechanism A (REGULATED, hold-before-receiving) ===');

  logStep('Generating issuer, user, and sponsor keypairs');
  const issuer = Keypair.random();
  const user = Keypair.random();
  const sponsor = Keypair.random();
  logInfo(`issuer:  ${issuer.publicKey()}`);
  logInfo(`user:    ${user.publicKey()}`);
  logInfo(`sponsor: ${sponsor.publicKey()}`);

  logStep('Funding accounts via Friendbot');
  await Promise.all([issuer, user, sponsor].map((kp) => friendbot(kp.publicKey())));
  logOk('funded');

  logStep('Enabling AUTH_REQUIRED, AUTH_REVOCABLE, and clawback on the issuer');
  await setRegulatedFlags(issuer);
  logOk('issuer is now a regulated asset issuer');

  const assetRef = { code: 'DEMO', issuer: issuer.publicKey() };
  const asset = toAsset(assetRef);

  logStep('Starting the approval server in-process (LocalSigner = issuer key)');
  const config: ServerConfig = {
    issuerSecret: issuer.secret(),
    network: NETWORK,
    horizonUrl: HORIZON_URL,
    assetCode: 'DEMO',
    adminToken: ADMIN_TOKEN,
    homeDomain: 'localhost',
    webAuthDomain: 'localhost',
    jwtSecret: 'demo-jwt-secret',
    port: PORT,
    host: '127.0.0.1',
  };
  const { app } = buildServer(config);
  await app.listen({ port: PORT, host: '127.0.0.1' });
  logOk('approval server up');

  logStep('Approving the user KYC (admin) and authenticating the user (SEP-10)');
  await postJson('/admin/kyc', { account: user.publicKey(), status: 'approved' }, admin);
  const session = await authenticate(user);
  logOk('user KYC approved and session authenticated');

  try {
    const userXlmBefore = await xlmBalance(user.publicKey());

    logStep('User builds a regulated authorize tx (sponsored trustline + issuer auth placeholder)');
    const built = buildAuthorize(
      {
        asset: assetRef,
        profile: 'regulated',
        user: user.publicKey(),
        sponsor: sponsor.publicKey(),
      },
      await load(user.publicKey()),
      NETWORK,
    );
    logInfo(`operation sequence: ${built.operations.map((o) => o.type).join(' → ')}`);
    logInfo(`issuer-auth op index: ${built.issuerAuthOpIndex}`);

    logStep('Requesting issuer approval');
    const approval = await postJson<ApprovalResult>('/tx-approve', { tx: built.xdr }, session);
    if (approval.status !== 'revised' || !approval.tx) {
      throw new Error(`unexpected approval status: ${approval.status} ${approval.message ?? ''}`);
    }
    logOk(`approval server returned status="${approval.status}" (issuer signature applied)`);

    logStep('User + sponsor co-sign and submit');
    const tx = parseTransaction(approval.tx, NETWORK);
    tx.sign(sponsor, user);
    await server.submitTransaction(tx);

    const line = await assetBalance(user.publicKey(), asset);
    const userXlmAfter = await xlmBalance(user.publicKey());
    if (!line) throw new Error('user has no DEMO trustline after authorize');
    if (line.authorized !== true) throw new Error('user trustline is not authorized');
    if (line.sponsor !== sponsor.publicKey())
      throw new Error('trustline reserve was not sponsored');
    if (userXlmBefore - userXlmAfter > 0.1)
      throw new Error('user paid the reserve — not sponsored');
    logOk(`user now holds an authorized, sponsored DEMO trustline (balance ${line.balance})`);
    logOk(`user XLM change: ${(userXlmBefore - userXlmAfter).toFixed(7)} (fee only)`);

    logStep('A subsequent withdrawal arrives — issuer pays the user with no trustline step');
    await submitOps(issuer, [
      Operation.payment({ destination: user.publicKey(), asset, amount: '100' }),
    ]);
    const funded = await assetBalance(user.publicKey(), asset);
    logOk(`user received the asset directly: ${funded?.balance} DEMO`);
    if (Number(funded?.balance) !== 100)
      throw new Error(`expected 100 DEMO, got ${funded?.balance}`);

    console.log(
      '\n\x1b[32m✓ Mechanism A complete: authorized trustline held before receiving, no XLM for the reserve.\x1b[0m\n',
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('\n\x1b[31m✗ Authorize demo failed:\x1b[0m', err?.message ?? err);
  process.exit(1);
});
