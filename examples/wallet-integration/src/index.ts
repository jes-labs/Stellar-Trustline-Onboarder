/**
 * Example: a self-custody wallet that onboards a user directly.
 *
 * The wallet holds the user's key, so instead of redirecting it builds the onboarding
 * transaction with the SDK, signs the user's part, and submits. The sponsor co-signs out of band
 * (for instance via the issuer's approval server). The code is illustrative and typechecked
 * against the SDK; it is not run.
 */
import type { Keypair } from '@stellar/stellar-sdk';
import { type AssetRef, submit, TESTNET, toTransaction } from '@trustline-onboarder/core';
import { detect, type OnboardingRequest, startOnboarding } from '@trustline-onboarder/sdk';

export interface ClaimInvite {
  asset: AssetRef;
  /** Account paying the trustline reserve. */
  sponsor: string;
  /** The claimable balance waiting for the user. */
  balanceId: string;
}

/**
 * Activate the user's account for an incoming claimable balance: build the sponsored claim,
 * sign the user's part, and submit. Returns the already-active state untouched.
 */
export async function activateForClaim(user: Keypair, invite: ClaimInvite): Promise<string> {
  const existing = await detect(TESTNET.horizonUrl, user.publicKey(), invite.asset);
  if (existing.hasTrustline && existing.authorized) {
    return 'already-active';
  }

  const request: OnboardingRequest = {
    network: TESTNET,
    mechanism: 'claimable',
    profile: 'unregulated',
    asset: invite.asset,
    recipient: user.publicKey(),
    sponsor: invite.sponsor,
    balanceId: invite.balanceId,
  };

  const started = await startOnboarding({ mode: 'direct', request });
  if (started.mode !== 'direct') throw new Error('expected a direct build');

  const tx = toTransaction(started.tx);
  tx.sign(user); // the sponsor adds its signature out of band before submission
  const result = await submit(TESTNET.horizonUrl, tx);
  return result.hash;
}
