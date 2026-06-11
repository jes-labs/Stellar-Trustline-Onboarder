/**
 * Example: an exchange that onboards a user mid-withdrawal.
 *
 * The exchange does not hold the user's key and does not run a sponsor, so it uses redirect mode:
 * it hands the user to the hosted activation page and verifies the result when they return. The
 * code is illustrative and typechecked against the SDK; it is not run.
 */
import { type AssetRef, TrustlineOnboarder } from '@trustline-onboarder/sdk';

const onboarder = new TrustlineOnboarder({
  network: 'testnet',
  serviceUrl: 'https://activate.example',
});

const RETURN_URL = 'https://acme.example/withdrawals/return';

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
 * already holds an authorized trustline, release the funds. Otherwise hand the user to the hosted
 * activation page.
 */
export async function onWithdrawalRequested(req: WithdrawalRequest): Promise<WithdrawalDecision> {
  const state = await onboarder.detect({ account: req.destination, asset: req.asset });
  if (state.hasTrustline && state.authorized) {
    return { action: 'release' };
  }

  const started = await onboarder.startOnboarding({
    asset: req.asset,
    destination: req.destination,
    amount: req.amount,
    balanceId: req.balanceId,
    returnUrl: RETURN_URL,
    platform: 'Acme Exchange',
    prefer: 'redirect',
  });
  if (started.mode !== 'redirect') throw new Error('expected a redirect');
  return { action: 'onboard', url: started.url };
}

/** When the user returns from activation, confirm it worked before releasing the funds. */
export async function onUserReturned(destination: string, asset: AssetRef): Promise<boolean> {
  return onboarder.verifyActivation({ account: destination, asset });
}
