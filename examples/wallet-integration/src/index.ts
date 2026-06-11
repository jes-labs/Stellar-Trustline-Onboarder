/**
 * Example: a self-custody wallet that onboards a user directly.
 *
 * The wallet holds the user's key and runs a bring-your-own sponsor, so it uses the direct path:
 * build the onboarding transaction, have the user sign it, and submit (the SDK adds the sponsor
 * signature on submit). The code is illustrative and typechecked against the SDK; it is not run.
 */
import { type Keypair, Transaction } from '@stellar/stellar-sdk';
import { type AssetRef, TrustlineOnboarder } from '@trustline-onboarder/sdk';

// The sponsor pays trustline reserves so the user needs no XLM. Bring-your-own; never hosted.
const onboarder = new TrustlineOnboarder({
  network: 'testnet',
  sponsor: { kind: 'keypair', secret: process.env.SPONSOR_SECRET ?? '' },
});

export interface ClaimInvite {
  asset: AssetRef;
  /** The claimable balance waiting for the user. */
  balanceId: string;
}

/**
 * Activate the user's account for an incoming claimable balance: build the sponsored claim, sign
 * the user's part, and submit. Returns the already-active state untouched.
 */
export async function activateForClaim(user: Keypair, invite: ClaimInvite): Promise<string> {
  const existing = await onboarder.detect({ account: user.publicKey(), asset: invite.asset });
  if (existing.hasTrustline && existing.authorized) {
    return 'already-active';
  }

  const plan = await onboarder.buildOnboardingTx({
    account: user.publicKey(),
    asset: invite.asset,
    balanceId: invite.balanceId,
  });

  // The wallet adds the user's signature; submit() adds the sponsor's signature and submits.
  const tx = new Transaction(plan.tx, plan.network);
  tx.sign(user);
  const settled = await onboarder.submit(tx.toXDR());
  return settled.hash;
}
