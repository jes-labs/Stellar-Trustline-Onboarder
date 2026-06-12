import type { AssetRef } from '@trustline-onboarder/core';
import { OnboardingError } from './errors';
import type { AssetOption, ClaimableAsset } from './types';

const ASSET_CODE = /^[A-Z0-9]{1,12}$/;

// --- Asset search (Horizon /assets) --------------------------------------------------------

interface HorizonAsset {
  asset_code: string;
  asset_issuer: string;
  flags?: { auth_required?: boolean };
  accounts?: {
    authorized?: number;
    authorized_to_maintain_liabilities?: number;
    unauthorized?: number;
  };
  _links?: { toml?: { href?: string } };
}

function holderCount(a: HorizonAsset): number {
  const acc = a.accounts ?? {};
  return (
    (acc.authorized ?? 0) + (acc.authorized_to_maintain_liabilities ?? 0) + (acc.unauthorized ?? 0)
  );
}

function tomlDomain(href?: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href).host;
  } catch {
    return undefined;
  }
}

/**
 * Search assets by code via Horizon `/assets`. A code can have many issuers, so each result
 * carries its own issuer and is ranked by holder count. Returns `[]` for an empty query; throws
 * `OnboardingError('failed')` for a malformed code or a lookup failure.
 */
export async function searchAssets(horizonUrl: string, code: string): Promise<AssetOption[]> {
  const c = code.trim().toUpperCase();
  if (!c) return [];
  if (!ASSET_CODE.test(c)) throw new OnboardingError('failed', 'invalid asset code');

  const url = new URL(`${horizonUrl}/assets`);
  url.searchParams.set('asset_code', c);
  url.searchParams.set('limit', '100');

  let records: HorizonAsset[];
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`horizon ${res.status}`);
    const body = (await res.json()) as { _embedded?: { records?: HorizonAsset[] } };
    records = body._embedded?.records ?? [];
  } catch {
    throw new OnboardingError('failed', 'asset lookup failed');
  }

  return records
    .map((r) => ({
      code: r.asset_code,
      issuer: r.asset_issuer,
      regulated: r.flags?.auth_required === true,
      holders: holderCount(r),
      domain: tomlDomain(r._links?.toml?.href),
    }))
    .sort((a, b) => b.holders - a.holders);
}

// --- Claimable balances (Horizon /claimable_balances) --------------------------------------

/** A claimable-balance predicate as Horizon returns it (a recursive JSON tree). */
export interface Predicate {
  unconditional?: boolean;
  abs_before?: string;
  abs_before_epoch?: string;
  rel_before?: string;
  not?: Predicate;
  and?: Predicate[];
  or?: Predicate[];
}

/**
 * Whether a claim predicate is satisfied at `nowSec` (unix seconds). A bare `rel_before` cannot be
 * evaluated without the balance's creation time, so it is treated as claimable (optimistic).
 */
export function predicateSatisfied(p: Predicate | undefined, nowSec: number): boolean {
  if (!p || p.unconditional) return true;
  if (p.not) return !predicateSatisfied(p.not, nowSec);
  if (p.and) return p.and.every((x) => predicateSatisfied(x, nowSec));
  if (p.or) return p.or.some((x) => predicateSatisfied(x, nowSec));
  if (p.abs_before_epoch !== undefined) return nowSec < Number(p.abs_before_epoch);
  if (p.abs_before !== undefined) return nowSec < Math.floor(Date.parse(p.abs_before) / 1000);
  return true;
}

/** Parse Horizon's `"CODE:ISSUER"` (or `"native"`) into an {@link AssetRef}; native → null. */
export function parseAssetString(asset: string): AssetRef | null {
  if (asset === 'native') return null;
  const [code, issuer] = asset.split(':');
  return code && issuer ? { code, issuer } : null;
}

interface ClaimableBalanceRecord {
  id: string;
  asset: string;
  amount: string;
  sponsor?: string;
  claimants?: { destination: string; predicate?: Predicate }[];
}

/**
 * List the classic assets `account` has a claimable balance for — every pending balance where it
 * is a claimant, with the balance id needed to claim it via `buildOnboardingTx({ balanceId })`.
 * Native XLM is excluded (it needs no trustline). `claimableNow` reflects the claim predicate.
 */
export async function listClaimableAssets(
  horizonUrl: string,
  account: string,
): Promise<ClaimableAsset[]> {
  const url = new URL(`${horizonUrl}/claimable_balances`);
  url.searchParams.set('claimant', account);
  url.searchParams.set('limit', '200');

  let records: ClaimableBalanceRecord[];
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`horizon ${res.status}`);
    const body = (await res.json()) as { _embedded?: { records?: ClaimableBalanceRecord[] } };
    records = body._embedded?.records ?? [];
  } catch {
    throw new OnboardingError('failed', 'claimable balance lookup failed');
  }

  const now = Math.floor(Date.now() / 1000);
  const out: ClaimableAsset[] = [];
  for (const r of records) {
    const asset = parseAssetString(r.asset);
    if (!asset) continue; // skip native — no trustline needed
    const mine = r.claimants?.find((c) => c.destination === account);
    out.push({
      balanceId: r.id,
      asset,
      amount: r.amount,
      sponsor: r.sponsor,
      claimableNow: mine ? predicateSatisfied(mine.predicate, now) : false,
    });
  }
  return out;
}
