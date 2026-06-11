import type { Account } from '@stellar/stellar-sdk';
import { type AssetRef, horizon, loadAccount, toAsset } from '@trustline-onboarder/core';
import { OnboardingError } from './errors';
import type { DetectResult } from './types';

/** Detect whether `account` already holds (and is authorized for) `asset`. */
export async function detectTrustline(
  horizonUrl: string,
  account: string,
  asset: AssetRef,
): Promise<DetectResult> {
  let acct: Awaited<ReturnType<ReturnType<typeof horizon>['loadAccount']>>;
  try {
    acct = await horizon(horizonUrl).loadAccount(account);
  } catch {
    // No account on chain means no trustline yet — a normal pre-onboarding state.
    return { hasTrustline: false, authorized: false };
  }
  const a = toAsset(asset);
  const line = acct.balances.find(
    (b) =>
      'asset_code' in b &&
      b.asset_code === a.getCode() &&
      'asset_issuer' in b &&
      b.asset_issuer === a.getIssuer(),
  );
  if (!line) return { hasTrustline: false, authorized: false };
  return {
    hasTrustline: true,
    authorized: 'is_authorized' in line ? Boolean(line.is_authorized) : true,
  };
}

/** Whether the issuer enforces AUTH_REQUIRED, read authoritatively from its account flags. */
export async function isRegulated(horizonUrl: string, issuer: string): Promise<boolean> {
  const account = await horizon(horizonUrl).loadAccount(issuer);
  return account.flags?.auth_required === true;
}

/** The issuer's home domain, used to discover its stellar.toml. */
export async function issuerHomeDomain(
  horizonUrl: string,
  issuer: string,
): Promise<string | undefined> {
  const account = await horizon(horizonUrl).loadAccount(issuer);
  return account.home_domain;
}

/** Load an account as a transaction source, mapping a missing account to a typed error. */
export async function loadSource(horizonUrl: string, address: string): Promise<Account> {
  try {
    return await loadAccount(horizonUrl, address);
  } catch {
    throw new OnboardingError('account-not-found', `account ${address} not found on the network`);
  }
}
