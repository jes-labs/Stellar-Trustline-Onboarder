/**
 * Phase 1 demo — Mechanism C, REGULATED (AUTH_REQUIRED) asset, end-to-end on Stellar testnet,
 * driven through the issuer-side approval server over HTTP.
 *
 * Flow: the recipient builds a sponsored claim that includes an issuer authorization op as a
 * placeholder, POSTs it to the approval server's `/tx-approve`, gets back the issuer-signed
 * ("revised") transaction, adds the sponsor + recipient signatures, and submits. Then the demo
 * exercises the MiCA admin operations (clawback, freeze) and prints the audit trail.
 *
 * Run:  pnpm demo:regulated   (builds @trustline-onboarder/core first)
 */

import { Keypair, Operation } from '@stellar/stellar-sdk';
import { buildServer } from '@trustline-onboarder/approval-server/app';
import type { ServerConfig } from '@trustline-onboarder/approval-server/config';
import {
  type ApprovalResult,
  buildClaimRegulated,
  buildCreateClaimableBalance,
  parseTransaction,
  predictBalanceId,
  toAsset,
  toTransaction,
} from '@trustline-onboarder/core';
import {
  assetBalance,
  authorizeTrustline,
  friendbot,
  HORIZON_URL,
  load,
  logInfo,
  logOk,
  logStep,
  NETWORK,
  server,
  setRegulatedFlags,
  signAndSubmit,
  submitOps,
} from './lib';

const PORT = 8788;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AMOUNT = '250';
const CLAWBACK = '50';
const ADMIN_TOKEN = 'demo-admin-token';

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

const admin = { authorization: `Bearer ${ADMIN_TOKEN}` };

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
  console.log('\n=== Trustline Onboarder — Mechanism C (REGULATED) via approval server ===');

  logStep('Generating issuer, distributor, sponsor, and recipient keypairs');
  const issuer = Keypair.random();
  const distributor = Keypair.random();
  const sponsor = Keypair.random();
  const recipient = Keypair.random();
  logInfo(`issuer:      ${issuer.publicKey()}`);
  logInfo(`recipient:   ${recipient.publicKey()}`);

  logStep('Funding accounts via Friendbot');
  await Promise.all(
    [issuer, distributor, sponsor, recipient].map((kp) => friendbot(kp.publicKey())),
  );
  logOk('funded');

  logStep('Enabling AUTH_REQUIRED, AUTH_REVOCABLE, and clawback on the issuer');
  await setRegulatedFlags(issuer);
  logOk('issuer is now a regulated asset issuer');

  logStep('Issuing DEMO to the distributor (issuer must authorize the distributor trustline)');
  const assetRef = { code: 'DEMO', issuer: issuer.publicKey() };
  const asset = toAsset(assetRef);
  // The distributor needs an authorized trustline before it can receive a regulated asset.
  await submitOps(distributor, [Operation.changeTrust({ asset })]);
  await authorizeTrustline(issuer, distributor.publicKey(), asset);
  await submitOps(issuer, [
    Operation.payment({ destination: distributor.publicKey(), asset, amount: '1000' }),
  ]);
  logOk(`distributor holds DEMO: ${(await assetBalance(distributor.publicKey(), asset))?.balance}`);

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
  const info = (await (await fetch(`${BASE_URL}/info`)).json()) as {
    issuer: string;
    mechanisms: string[];
  };
  logOk(`approval server up — issuer ${info.issuer}, mechanisms ${info.mechanisms.join(', ')}`);

  logStep('Approving the recipient KYC (admin) and authenticating the recipient (SEP-10)');
  await postJson('/admin/kyc', { account: recipient.publicKey(), status: 'approved' }, admin);
  const session = await authenticate(recipient);
  logOk('recipient KYC approved and session authenticated');

  try {
    logStep(`Distributor creates a claimable balance of ${AMOUNT} DEMO to the recipient`);
    const createBuilt = buildCreateClaimableBalance(
      {
        asset: assetRef,
        amount: AMOUNT,
        recipient: recipient.publicKey(),
        sender: distributor.publicKey(),
      },
      await load(distributor.publicKey()),
      NETWORK,
    );
    const balanceId = predictBalanceId(toTransaction(createBuilt), 0);
    await signAndSubmit(createBuilt, [distributor]);
    logOk(`claimable balance created: ${balanceId}`);

    logStep(
      'Recipient builds a regulated claim (with issuer-auth placeholder) and requests approval',
    );
    const claimBuilt = buildClaimRegulated(
      {
        asset: assetRef,
        recipient: recipient.publicKey(),
        sponsor: sponsor.publicKey(),
        balanceId,
      },
      await load(recipient.publicKey()),
      NETWORK,
    );
    logInfo(`operation sequence: ${claimBuilt.operations.map((o) => o.type).join(' → ')}`);
    logInfo(`issuer-auth op index: ${claimBuilt.issuerAuthOpIndex}`);

    const approval = await postJson<ApprovalResult>('/tx-approve', { tx: claimBuilt.xdr }, session);
    if (approval.status !== 'revised' || !approval.tx) {
      throw new Error(`unexpected approval status: ${approval.status} ${approval.message ?? ''}`);
    }
    logOk(`approval server returned status="${approval.status}" (issuer signature applied)`);

    logStep('Recipient + sponsor co-sign the approved transaction and submit');
    const approved = parseTransaction(approval.tx, NETWORK);
    approved.sign(sponsor, recipient);
    await server.submitTransaction(approved);
    const claimed = await assetBalance(recipient.publicKey(), asset);
    logOk(
      `recipient DEMO balance: ${claimed?.balance} (authorized=${claimed?.authorized}, sponsor=${claimed?.sponsor})`,
    );
    if (Number(claimed?.balance) !== Number(AMOUNT)) {
      throw new Error(`expected ${AMOUNT} DEMO, got ${claimed?.balance}`);
    }

    logStep(`MiCA: issuer claws back ${CLAWBACK} DEMO from the recipient`);
    const clawRes = await postJson<{ status: string; hash: string }>(
      '/admin/clawback',
      {
        from: recipient.publicKey(),
        amount: CLAWBACK,
        reason: 'regulatory order (demo)',
      },
      admin,
    );
    const afterClaw = await assetBalance(recipient.publicKey(), asset);
    logOk(`clawback tx ${clawRes.hash?.slice(0, 8)}… — recipient DEMO now ${afterClaw?.balance}`);

    logStep('MiCA: issuer freezes the recipient (clears the AUTHORIZED flag)');
    await postJson(
      '/admin/freeze',
      {
        trustor: recipient.publicKey(),
        reason: 'suspected fraud (demo)',
      },
      admin,
    );
    const frozen = await assetBalance(recipient.publicKey(), asset);
    logOk(`recipient trustline authorized=${frozen?.authorized} (frozen)`);
    if (frozen?.authorized !== false) throw new Error('expected the trustline to be frozen');

    logStep('Reading the issuer audit trail');
    const { entries } = (await (await fetch(`${BASE_URL}/audit`)).json()) as {
      entries: { timestamp: string; action: string; subject: string; reason?: string }[];
    };
    for (const e of entries) {
      logInfo(
        `${e.timestamp}  ${e.action.toUpperCase()}  subject=${e.subject}${e.reason ? `  reason="${e.reason}"` : ''}`,
      );
    }

    console.log(
      '\n\x1b[32m✓ Regulated onboarding complete: issuer-authorized claim, clawback, freeze, and an audit trail.\x1b[0m\n',
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('\n\x1b[31m✗ Regulated demo failed:\x1b[0m', err?.message ?? err);
  process.exit(1);
});
