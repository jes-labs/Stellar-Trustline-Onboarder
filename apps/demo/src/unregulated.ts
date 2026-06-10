/**
 * Phase 0 demo — Mechanism C, unregulated asset, end-to-end on Stellar testnet.
 *
 * Proves a zero-touch receive: a claimable balance is created to a recipient who has NO
 * trustline, then claimed with a sponsored trustline so the recipient pays no reserve. The
 * recipient ends with a usable balance.
 *
 * Run:  pnpm demo   (build @trustline-onboarder/core first: pnpm --filter ...core build)
 */

import { Keypair } from '@stellar/stellar-sdk';
import {
  buildClaimUnregulated,
  buildCreateClaimableBalance,
  predictBalanceId,
  toAsset,
  toTransaction,
} from '@trustline-onboarder/core';
import {
  assetBalance,
  friendbot,
  issueAsset,
  load,
  logInfo,
  logOk,
  logStep,
  NETWORK,
  signAndSubmit,
  xlmBalance,
} from './lib';

const AMOUNT = '250';

async function main(): Promise<void> {
  console.log('\n=== Trustline Onboarder — Mechanism C (unregulated) on testnet ===');

  logStep('Generating issuer, distributor, sponsor, and recipient keypairs');
  const issuer = Keypair.random();
  const distributor = Keypair.random();
  const sponsor = Keypair.random();
  const recipient = Keypair.random();
  logInfo(`issuer:      ${issuer.publicKey()}`);
  logInfo(`distributor: ${distributor.publicKey()}`);
  logInfo(`sponsor:     ${sponsor.publicKey()}`);
  logInfo(`recipient:   ${recipient.publicKey()}`);

  logStep('Funding all four accounts via Friendbot');
  await Promise.all(
    [issuer, distributor, sponsor, recipient].map((kp) => friendbot(kp.publicKey())),
  );
  logOk('funded');

  logStep('Issuing the DEMO asset (distributor trustline + issuer payment)');
  const asset = await issueAsset(issuer, distributor, 'DEMO', '1000');
  logOk(`distributor holds DEMO: ${(await assetBalance(distributor.publicKey(), asset))?.balance}`);

  logStep('Confirming the recipient has NO trustline for DEMO');
  const before = await assetBalance(
    recipient.publicKey(),
    toAsset({ code: 'DEMO', issuer: issuer.publicKey() }),
  );
  if (before) throw new Error('expected recipient to have no DEMO trustline yet');
  logOk('recipient has no DEMO trustline (a normal withdrawal would fail here)');

  logStep(`Distributor creates a claimable balance of ${AMOUNT} DEMO to the recipient`);
  const createBuilt = buildCreateClaimableBalance(
    {
      asset: { code: 'DEMO', issuer: issuer.publicKey() },
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

  const recipientXlmBefore = await xlmBalance(recipient.publicKey());
  logInfo(`recipient XLM before claim: ${recipientXlmBefore}`);

  logStep('Recipient claims with a SPONSORED trustline (sponsor + recipient co-sign)');
  const claimBuilt = buildClaimUnregulated(
    {
      asset: { code: 'DEMO', issuer: issuer.publicKey() },
      recipient: recipient.publicKey(),
      sponsor: sponsor.publicKey(),
      balanceId,
    },
    await load(recipient.publicKey()),
    NETWORK,
  );
  logInfo(`operation sequence: ${claimBuilt.operations.map((o) => o.type).join(' → ')}`);
  await signAndSubmit(claimBuilt, [sponsor, recipient]);
  logOk('claim submitted');

  logStep('Verifying the result');
  const after = await assetBalance(recipient.publicKey(), asset);
  const recipientXlmAfter = await xlmBalance(recipient.publicKey());
  const reserveDelta = recipientXlmBefore - recipientXlmAfter;

  if (!after) throw new Error('recipient has no DEMO balance after claim');
  if (Number(after.balance) !== Number(AMOUNT)) {
    throw new Error(`expected DEMO balance ${AMOUNT}, got ${after.balance}`);
  }
  if (after.sponsor !== sponsor.publicKey()) {
    throw new Error(`expected trustline sponsored by ${sponsor.publicKey()}, got ${after.sponsor}`);
  }
  // The recipient must not have paid the ~0.5 XLM trustline reserve — only the tx fee.
  if (reserveDelta > 0.1) {
    throw new Error(`recipient paid ${reserveDelta} XLM — the reserve was NOT sponsored`);
  }

  logOk(`recipient DEMO balance: ${after.balance}`);
  logOk(`trustline reserve sponsored by: ${after.sponsor}`);
  logOk(`recipient XLM change: ${reserveDelta.toFixed(7)} (fee only — reserve was sponsored)`);
  console.log(
    '\n\x1b[32m✓ Zero-touch receive complete: no manual trustline step, no XLM for the reserve.\x1b[0m\n',
  );
}

main().catch((err) => {
  console.error('\n\x1b[31m✗ Demo failed:\x1b[0m', err?.message ?? err);
  process.exit(1);
});
