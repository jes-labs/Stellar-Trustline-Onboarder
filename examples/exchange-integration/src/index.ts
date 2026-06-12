/**
 * Example: an exchange that onboards a user mid-withdrawal.
 *
 * The exchange does not hold the user's key, so it redirects to the activation page and verifies
 * the result when the user returns — the most common integration. The code is illustrative and
 * typechecked against the SDK; the runnable end-to-end version is in `exchange.ts`.
 */
import { type AssetRef, TrustlineOnboarder } from '@trustline-onboarder/sdk';

const RETURN_URL = 'https://acme.example/withdrawals/return';

// Redirect mode needs no sponsor: the hosted activation page sponsors within its own gated session.
const onboarder = new TrustlineOnboarder({
  network: 'testnet',
  serviceUrl: 'https://activate.example',
});

export interface WithdrawalRequest {
  destination: string;
  asset: AssetRef;
  amount: string;
  /** Set when the exchange will send the funds as a claimable balance. */
  balanceId?: string;
}

export type WithdrawalDecision = { action: 'release' } | { action: 'onboard'; url: string };

/**
 * When a withdrawal is requested, check whether the destination can receive the asset. If it
 * already holds an authorized trustline, release the funds. Otherwise send the user through
 * activation first.
 */
export async function onWithdrawalRequested(req: WithdrawalRequest): Promise<WithdrawalDecision> {
  const state = await onboarder.detect({ account: req.destination, asset: req.asset });
  if (state.hasTrustline && state.authorized) {
    return { action: 'release' };
  }

  const result = await onboarder.startOnboarding({
    asset: req.asset,
    destination: req.destination,
    amount: req.amount,
    balanceId: req.balanceId,
    platform: 'Acme Exchange',
    returnUrl: RETURN_URL,
    prefer: 'redirect',
  });
  if (result.mode !== 'redirect') throw new Error('expected a redirect');
  return { action: 'onboard', url: result.url };
}

/** When the user returns from activation, confirm it worked before releasing the funds. */
export function onUserReturned(destination: string, asset: AssetRef): Promise<boolean> {
  return onboarder.verifyActivation({ account: destination, asset });
}
