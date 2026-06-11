import { NextResponse } from 'next/server';
import type { ActivationConfig } from '../../../../lib/types';

export const runtime = 'nodejs';

interface BuildBody {
  config?: ActivationConfig;
  address?: string;
  walletId?: string;
}

/**
 * Build the unsigned activation transaction and run the issuer approval for regulated assets.
 *
 * Real implementation: construct the sponsored claim/authorize transaction with
 * `@trustline-onboarder/core`, and for a regulated asset POST it to the issuer's SEP-8 approval
 * server, mapping `action_required` to KYC and `rejected` to compliance. It returns the XDR the
 * browser then signs. For now it returns a placeholder and honours the `simulate` override.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: BuildBody;
  try {
    body = (await request.json()) as BuildBody;
  } catch {
    return NextResponse.json({ code: 'failed', message: 'invalid request body' }, { status: 400 });
  }

  if (!body.config || !body.address) {
    return NextResponse.json(
      { code: 'failed', message: 'missing config or address' },
      { status: 400 },
    );
  }

  const simulate = body.config.simulate;
  if (simulate === 'kyc') {
    return NextResponse.json({ code: 'kyc' }, { status: 422 });
  }
  if (simulate === 'rejected') {
    return NextResponse.json({ code: 'rejected' }, { status: 422 });
  }

  return NextResponse.json({ xdr: 'UNSIGNED_TRANSACTION_PLACEHOLDER' });
}
