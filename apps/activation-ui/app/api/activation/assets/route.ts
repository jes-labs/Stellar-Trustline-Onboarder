import { OnboardingError, TrustlineOnboarder } from '@trustline-onboarder/sdk';
import { NextResponse } from 'next/server';
import { guard } from '../../../../lib/guard';
import { HORIZON_URL, IS_TESTNET } from '../../../../lib/serverStellar';

export const runtime = 'nodejs';

// Asset search lives in the SDK; this route is a thin, gated proxy so the browser never needs the
// Horizon URL directly. The picker calls it; adopters can call `TrustlineOnboarder.searchAssets`.
const onboarder = new TrustlineOnboarder({
  network: IS_TESTNET ? 'testnet' : 'public',
  horizonUrl: HORIZON_URL,
});

export async function GET(request: Request): Promise<NextResponse> {
  const blocked = guard(request, 40);
  if (blocked) return blocked;

  const code = (new URL(request.url).searchParams.get('code') ?? '').trim();
  // Empty query: nothing to search yet. The picker shows suggestions until the user types.
  if (!code) return NextResponse.json({ assets: [] });

  try {
    const assets = await onboarder.searchAssets(code);
    return NextResponse.json({ assets });
  } catch (err) {
    const message = err instanceof OnboardingError ? err.message : 'asset lookup failed';
    const status = message === 'invalid asset code' ? 400 : 502;
    return NextResponse.json({ code: 'failed', message }, { status });
  }
}
