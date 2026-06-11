import { NextResponse } from 'next/server';
import { guard } from '../../../../lib/guard';
import type { AssetOption } from '../../../../lib/types';

export const runtime = 'nodejs';
// Horizon results are stable enough to cache briefly; keeps the picker responsive.
export const revalidate = 60;

const HORIZON_URL = process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

/** Horizon `/assets` record (the fields we use). */
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
 * Search testnet assets by code via Horizon `/assets`. A code can have many issuers, so each
 * result carries its own issuer; the picker uses that to disambiguate. Asset codes are 1–12
 * characters of `[A-Za-z0-9]`, so anything else is rejected before it reaches Horizon.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const blocked = guard(request, 40);
  if (blocked) return blocked;

  const url = new URL(request.url);
  const code = (url.searchParams.get('code') ?? '').trim().toUpperCase();

  // Empty query: nothing to search yet. The picker shows suggestions until the user types.
  if (!code) return NextResponse.json({ assets: [] satisfies AssetOption[] });
  if (!/^[A-Z0-9]{1,12}$/.test(code)) {
    return NextResponse.json({ code: 'failed', message: 'invalid asset code' }, { status: 400 });
  }

  const horizon = new URL(`${HORIZON_URL}/assets`);
  horizon.searchParams.set('asset_code', code);
  horizon.searchParams.set('limit', '100');

  let records: HorizonAsset[];
  try {
    const res = await fetch(horizon, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      return NextResponse.json({ code: 'failed', message: 'asset lookup failed' }, { status: 502 });
    }
    const body = (await res.json()) as { _embedded?: { records?: HorizonAsset[] } };
    records = body._embedded?.records ?? [];
  } catch {
    return NextResponse.json({ code: 'failed', message: 'asset lookup failed' }, { status: 502 });
  }

  const assets: AssetOption[] = records
    .map((r) => ({
      code: r.asset_code,
      issuer: r.asset_issuer,
      regulated: r.flags?.auth_required === true,
      holders: holderCount(r),
      domain: tomlDomain(r._links?.toml?.href),
    }))
    .sort((a, b) => b.holders - a.holders);

  return NextResponse.json({ assets });
}
