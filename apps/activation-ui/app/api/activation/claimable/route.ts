import { TrustlineOnboarder } from '@trustline-onboarder/sdk';
import { NextResponse } from 'next/server';
import { guard } from '../../../../lib/guard';
import { HORIZON_URL, IS_TESTNET } from '../../../../lib/serverStellar';

export const runtime = 'nodejs';

// Lists the assets a connected wallet has a pending claimable balance for. Delegates to the SDK,
// which carries the `balanceId` each entry can be activated-and-claimed with.
const onboarder = new TrustlineOnboarder({
  network: IS_TESTNET ? 'testnet' : 'public',
  horizonUrl: HORIZON_URL,
});

const STELLAR_ACCOUNT = /^G[A-Z2-7]{55}$/;

export async function GET(request: Request): Promise<NextResponse> {
  const blocked = guard(request, 40);
  if (blocked) return blocked;

  const account = (new URL(request.url).searchParams.get('account') ?? '').trim().toUpperCase();
  if (!STELLAR_ACCOUNT.test(account)) {
    return NextResponse.json({ code: 'failed', message: 'invalid account' }, { status: 400 });
  }

  try {
    const claimable = await onboarder.listClaimableAssets(account);
    return NextResponse.json({ claimable });
  } catch {
    return NextResponse.json(
      { code: 'failed', message: 'claimable balance lookup failed' },
      { status: 502 },
    );
  }
}
