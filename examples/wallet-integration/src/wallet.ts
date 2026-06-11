/**
 * Example: a self-custody wallet adopting @trustline-onboarder/sdk.
 *
 * Shows the recipient side end-to-end on testnet: the wallet detects that its user has no
 * trustline for an asset, then onboards them with a sponsored trustline (no XLM, no manual
 * trustline prompt) by signing with the user's key. It also shows the redirect alternative a
 * wallet can use instead of building the transaction itself.
 *
 * Run:  pnpm --filter @trustline-onboarder/example-wallet start
 */

import { Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import { TrustlineOnboarder } from '@trustline-onboarder/sdk';
import { activateWithWallet } from '@trustline-onboarder/sdk/client';

const PASSPHRASE = Networks.TESTNET;

async function friendbot(publicKey: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) throw new Error(`Friendbot failed for ${publicKey}: ${res.status}`);
}

function log(message: string): void {
  console.log(message);
}

async function main(): Promise<void> {
  log('\n=== Wallet integration — onboarding a user into a Stellar asset ===\n');

  // The wallet holds the user's key. The issuer mints an unregulated asset; the sponsor pays the
  // trustline reserve. All three are funded on testnet so the example is self-contained.
  const userKp = Keypair.random();
  const issuer = Keypair.random();
  const sponsor = Keypair.random();
  await Promise.all([userKp, issuer, sponsor].map((kp) => friendbot(kp.publicKey())));
  const asset = { code: 'DEMO', issuer: issuer.publicKey() };
  log(`user:    ${userKp.publicKey()}`);
  log(`asset:   ${asset.code}:${asset.issuer.slice(0, 8)}…`);
  log(`sponsor: ${sponsor.publicKey()}\n`);

  // An adopter constructs the SDK once. The sponsor is bring-your-own (here a local keypair; in
  // production a KMS-backed signer via @trustline-onboarder/sdk/server).
  const onboarder = new TrustlineOnboarder({
    network: 'testnet',
    serviceUrl: 'https://activate.trustline.example',
    sponsor: { kind: 'keypair', secret: sponsor.secret() },
  });

  // 1) Detect — does the user already hold the asset? (Gate onboarding on this.)
  const before = await onboarder.detect({ account: userKp.publicKey(), asset });
  log(`1. detect → hasTrustline=${before.hasTrustline} authorized=${before.authorized}`);
  if (before.hasTrustline) {
    log('   already onboarded — nothing to do.');
    return;
  }

  // 2) Onboard — build, sign with the user's key in-wallet, submit. The /client helper runs the
  //    whole build → sign → submit sequence; `sign` is the wallet's own signing function.
  log('2. onboarding (sponsored trustline, user signs in-wallet)…');
  const sign = async (xdr: string): Promise<string> => {
    const tx = new Transaction(xdr, PASSPHRASE);
    tx.sign(userKp);
    return tx.toXDR();
  };
  const settled = await activateWithWallet(onboarder, { asset, account: userKp.publicKey() }, sign);
  log(`   submitted: ${settled.hash}`);
  log(`   ${settled.explorerUrl}`);

  // 3) Verify — confirm the trustline exists before treating the user as onboarded.
  const ok = await onboarder.verifyActivation({ account: userKp.publicKey(), asset });
  log(`3. verifyActivation → ${ok}`);

  // Alternative: a wallet that prefers not to build the transaction can hand the user to the
  // hosted activation page instead. Same SDK, redirect mode.
  const handoff = await onboarder.startOnboarding({
    asset,
    destination: userKp.publicKey(),
    prefer: 'redirect',
  });
  if (handoff.mode === 'redirect') log(`\n   (redirect alternative) ${handoff.url}`);

  log(
    ok
      ? '\n✓ The user holds the asset with a sponsored trustline — no XLM, no manual trustline step.\n'
      : '\n✗ Onboarding did not verify.\n',
  );
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('\n✗ Wallet example failed:', err?.message ?? err);
  process.exit(1);
});
