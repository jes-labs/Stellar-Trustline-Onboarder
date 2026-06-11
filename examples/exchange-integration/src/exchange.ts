/**
 * Example: an exchange/broker adopting @trustline-onboarder/sdk.
 *
 * Shows the sender side on testnet. When a withdrawal targets a user with no trustline, an
 * exchange has two options, both covered here:
 *
 *   A) Redirect — hand the user to the hosted activation page (the exchange does not hold the
 *      user's key). `startOnboarding({ prefer: 'redirect' })` returns the URL.
 *   B) Send now, claim later — create a claimable balance to the user with `buildSend`, then the
 *      user claims it later with a sponsored trustline (the recipient/SDK flow). The full
 *      round-trip runs here.
 *
 * Run:  pnpm --filter @trustline-onboarder/example-exchange start
 */

import {
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  type xdr,
} from '@stellar/stellar-sdk';
import { loadAccount, predictBalanceId, submit, toTransaction } from '@trustline-onboarder/core';
import { TrustlineOnboarder } from '@trustline-onboarder/sdk';
import { sponsorFromSecret } from '@trustline-onboarder/sdk/server';

const PASSPHRASE = Networks.TESTNET;
const HORIZON = 'https://horizon-testnet.stellar.org';

async function friendbot(publicKey: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) throw new Error(`Friendbot failed for ${publicKey}: ${res.status}`);
}

const log = (m: string): void => console.log(m);

/** Build, sign, and submit plain operations — test scaffolding to mint the demo asset. */
async function submitOps(
  source: Keypair,
  ops: xdr.Operation[],
  extra: Keypair[] = [],
): Promise<void> {
  const account = await loadAccount(HORIZON, source.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: PASSPHRASE,
  });
  for (const op of ops) builder.addOperation(op);
  const tx = builder.setTimeout(120).build();
  tx.sign(source, ...extra);
  await submit(HORIZON, tx);
}

/** Issue a classic asset to a distributor (distributor trustline + issuer payment). */
async function issueAsset(
  issuer: Keypair,
  distributor: Keypair,
  code: string,
  amount: string,
): Promise<Asset> {
  const asset = new Asset(code, issuer.publicKey());
  await submitOps(distributor, [Operation.changeTrust({ asset })]);
  await submitOps(issuer, [
    Operation.payment({ destination: distributor.publicKey(), asset, amount }),
  ]);
  return asset;
}

async function main(): Promise<void> {
  log('\n=== Exchange integration — onboarding a withdrawing user ===\n');

  // Exchange-side accounts (issuer, distributor, sponsor) plus the withdrawing user.
  const issuer = Keypair.random();
  const distributor = Keypair.random();
  const sponsor = Keypair.random();
  const user = Keypair.random();
  await Promise.all([issuer, distributor, sponsor, user].map((kp) => friendbot(kp.publicKey())));
  await issueAsset(issuer, distributor, 'DEMO', '1000');
  const asset = { code: 'DEMO', issuer: issuer.publicKey() };
  log(`user (withdrawing to): ${user.publicKey()}`);
  log(`asset: ${asset.code}:${asset.issuer.slice(0, 8)}…\n`);

  const onboarder = new TrustlineOnboarder({
    network: 'testnet',
    serviceUrl: 'https://activate.trustline.example',
    sponsor: sponsorFromSecret(sponsor.secret()),
  });

  // The withdrawal targets a user with no trustline — the recurring blocker this solves.
  const status = await onboarder.detect({ account: user.publicKey(), asset });
  log(`detect → hasTrustline=${status.hasTrustline} (a normal withdrawal would fail here)\n`);

  // --- Option A: redirect the user to activate, then complete the payout ------------------
  const handoff = await onboarder.startOnboarding({
    asset,
    destination: user.publicKey(),
    amount: '100.00',
    platform: 'Acme Exchange',
    returnUrl: 'https://acme.example/withdraw/done',
    prefer: 'redirect',
  });
  log(`A) Redirect option → ${handoff.mode}:`);
  log(`   ${handoff.mode === 'redirect' ? handoff.url : '(direct)'}\n`);

  // --- Option B: send now, claim later (claimable balance) -------------------------------
  log('B) Send-now-claim-later:');
  const built = await onboarder.buildSend({
    asset,
    amount: '100',
    recipient: user.publicKey(),
    sender: distributor.publicKey(),
  });
  const sendTx = toTransaction(built);
  const balanceId = predictBalanceId(sendTx, 0);
  sendTx.sign(distributor);
  await submit(HORIZON, sendTx);
  log(`   exchange created a claimable balance: ${balanceId}`);

  // Later, on the user's side (their wallet, via the SDK): claim with a sponsored trustline.
  const plan = await onboarder.buildOnboardingTx({
    asset,
    account: user.publicKey(),
    balanceId,
  });
  const claimTx = new Transaction(plan.tx, PASSPHRASE);
  claimTx.sign(user);
  const settled = await onboarder.submit(claimTx.toXDR());
  log(`   user claimed it with a sponsored trustline: ${settled.hash.slice(0, 16)}…`);

  const ok = await onboarder.verifyActivation({ account: user.publicKey(), asset });
  log(`   verifyActivation → ${ok}`);

  log(
    ok
      ? '\n✓ The withdrawal completed: the user holds the asset, paid no reserve, set up no trustline.\n'
      : '\n✗ Claim did not verify.\n',
  );
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('\n✗ Exchange example failed:', err?.message ?? err);
  process.exit(1);
});
