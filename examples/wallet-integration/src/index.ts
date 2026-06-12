/**
 * Example: a self-custody wallet that onboards a user directly.
 *
 * The wallet holds the user's key, so instead of redirecting it builds the onboarding transaction
 * with the SDK, signs the user's part in-wallet, and submits (the configured sponsor co-signs
 * inside `submit`). The code is illustrative and typechecked against the SDK; the runnable
 * end-to-end version is in `wallet.ts`.
 */
import { type Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import { type AssetRef, TrustlineOnboarder } from '@trustline-onboarder/sdk';
import { activateWithWallet } from '@trustline-onboarder/sdk/client';

const PASSPHRASE = Networks.TESTNET;

export interface ClaimInvite {
  asset: AssetRef;
  /** The claimable balance waiting for the user. */
  balanceId: string;
}

/**
 * Activate the user's account for an incoming claimable balance: build the sponsored claim, sign
 * the user's part in-wallet, and submit. Returns the settled transaction hash, or `already-active`
 * when the trustline already exists.
 *
 * `sponsorSecret` is the wallet's bring-your-own sponsor (here a raw secret; in production a
 * KMS-backed signer via `@trustline-onboarder/sdk/server`).
 */
export async function activateForClaim(
  user: Keypair,
  invite: ClaimInvite,
  sponsorSecret: string,
): Promise<string> {
  const onboarder = new TrustlineOnboarder({
    network: 'testnet',
    sponsor: { kind: 'keypair', secret: sponsorSecret },
  });

  const existing = await onboarder.detect({ account: user.publicKey(), asset: invite.asset });
  if (existing.hasTrustline && existing.authorized) return 'already-active';

  // The wallet's own signing function: sign the SDK-built XDR with the user's key.
  const sign = async (xdr: string): Promise<string> => {
    const tx = new Transaction(xdr, PASSPHRASE);
    tx.sign(user);
    return tx.toXDR();
  };

  const settled = await activateWithWallet(
    onboarder,
    { asset: invite.asset, account: user.publicKey(), balanceId: invite.balanceId },
    sign,
  );
  return settled.hash;
}
