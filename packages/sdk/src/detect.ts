import { type AssetRef, horizon } from '@trustline-onboarder/core';

/** The state of an account's trustline for a given asset. */
export interface TrustlineState {
  /** Whether the account exists on the network at all. */
  accountExists: boolean;
  /** Whether the account holds a trustline for the asset. */
  hasTrustline: boolean;
  /** Whether the trustline is authorized (always true for unregulated assets). */
  authorized: boolean;
  /** The current balance, when a trustline exists. */
  balance?: string;
}

// The fields we read off a Horizon balance line. Narrowed so the pure helper can be tested
// without constructing a full Horizon response.
interface BalanceLineLike {
  asset_code?: string;
  asset_issuer?: string;
  is_authorized?: boolean;
  balance?: string;
}

/** Pure trustline lookup over a set of balance lines. */
export function readTrustline(
  balances: readonly BalanceLineLike[],
  asset: AssetRef,
): Omit<TrustlineState, 'accountExists'> {
  const line = balances.find((b) => b.asset_code === asset.code && b.asset_issuer === asset.issuer);
  if (!line) return { hasTrustline: false, authorized: false };
  return { hasTrustline: true, authorized: line.is_authorized ?? true, balance: line.balance };
}

/**
 * Read an account's trustline state for an asset from Horizon. A platform calls this to decide
 * whether a withdrawal needs onboarding. A missing account reports as not existing rather than
 * throwing.
 */
export async function detect(
  horizonUrl: string,
  account: string,
  asset: AssetRef,
): Promise<TrustlineState> {
  try {
    const loaded = await horizon(horizonUrl).loadAccount(account);
    return { accountExists: true, ...readTrustline(loaded.balances, asset) };
  } catch (err) {
    if (isNotFound(err)) return { accountExists: false, hasTrustline: false, authorized: false };
    throw err;
  }
}

function isNotFound(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 404 || (err as { name?: string })?.name === 'NotFoundError';
}
