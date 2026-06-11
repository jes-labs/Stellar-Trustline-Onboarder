/**
 * Example: an exchange that onboards a user mid-withdrawal.
 *
 * The exchange does not hold the user's key, so it redirects to the activation page and verifies
 * the result when the user returns. This is the most common integration. The code is
 * illustrative and typechecked against the SDK; it is not run.
 */
import { type AssetRef, TESTNET } from '@trustline-onboarder/core';
import {
  type ActivationParams,
  buildActivationUrl,
  detect,
  verifyActivation,
} from '@trustline-onboarder/sdk';

const HORIZON = TESTNET.horizonUrl;
const ACTIVATION_PAGE = 'https://activate.example/withdraw';
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
 * already holds an authorized trustline, release the funds. Otherwise send the user through
 * activation first.
 */
export async function onWithdrawalRequested(req: WithdrawalRequest): Promise<WithdrawalDecision> {
  const state = await detect(HORIZON, req.destination, req.asset);
  if (state.hasTrustline && state.authorized) {
    return { action: 'release' };
  }

  const params: ActivationParams = {
    asset: req.asset.code,
    issuer: req.asset.issuer,
    amount: req.amount,
    platform: 'Acme Exchange',
    destination: req.destination,
    balanceId: req.balanceId,
    returnUrl: RETURN_URL,
  };
  return { action: 'onboard', url: buildActivationUrl(ACTIVATION_PAGE, params) };
}

/** When the user returns from activation, confirm it worked before releasing the funds. */
export async function onUserReturned(destination: string, asset: AssetRef): Promise<boolean> {
  return verifyActivation(HORIZON, destination, asset, { requireAuthorized: true });
}
