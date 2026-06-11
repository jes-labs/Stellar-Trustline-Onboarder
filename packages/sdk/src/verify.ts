import type { AssetRef } from '@trustline-onboarder/core';
import { detect } from './detect';

export interface VerifyOptions {
  /** Require the trustline to be authorized (use for regulated assets). */
  requireAuthorized?: boolean;
  /** Require at least this balance (use to confirm a claim settled). */
  minBalance?: string;
}

/**
 * Confirm that onboarding completed: the account holds the trustline and, optionally, that it is
 * authorized and funded to at least `minBalance`. A platform calls this after the activation flow
 * returns to verify the withdrawal can proceed.
 */
export async function verifyActivation(
  horizonUrl: string,
  account: string,
  asset: AssetRef,
  opts: VerifyOptions = {},
): Promise<boolean> {
  const state = await detect(horizonUrl, account, asset);
  if (!state.hasTrustline) return false;
  if (opts.requireAuthorized && !state.authorized) return false;
  if (opts.minBalance !== undefined && Number(state.balance ?? '0') < Number(opts.minBalance)) {
    return false;
  }
  return true;
}
