import { NextResponse } from 'next/server';
import { buildActivationTx, ChainError } from '../../../../lib/chain';
import { isLiveConfigured } from '../../../../lib/server-config';
import type { ActivationConfig } from '../../../../lib/types';

export const runtime = 'nodejs';

interface BuildBody {
  config?: ActivationConfig;
  address?: string;
}

/**
 * Build the unsigned activation transaction and run the issuer approval for regulated assets.
 * Returns the XDR (sponsor- and, if regulated, issuer-signed) for the browser to sign. When the
 * chain is not configured, returns a placeholder and the route simulates.
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

  // QA previews of the approval-time edge states.
  const simulate = body.config.simulate;
  if (simulate === 'kyc') return NextResponse.json({ code: 'kyc' }, { status: 422 });
  if (simulate === 'rejected') return NextResponse.json({ code: 'rejected' }, { status: 422 });

  if (!isLiveConfigured()) {
    return NextResponse.json({
      xdr: 'UNSIGNED_TRANSACTION_PLACEHOLDER',
      networkPassphrase: 'SIMULATED',
      simulated: true,
    });
  }

  try {
    const { xdr, networkPassphrase } = await buildActivationTx(body.config, body.address);
    return NextResponse.json({ xdr, networkPassphrase, simulated: false });
  } catch (err) {
    if (err instanceof ChainError) return NextResponse.json({ code: err.code }, { status: 422 });
    return NextResponse.json({ code: 'failed' }, { status: 500 });
  }
}
