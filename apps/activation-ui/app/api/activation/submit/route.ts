import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { ActivationConfig } from '../../../../lib/types';

export const runtime = 'nodejs';

const EXPLORER_TX = 'https://stellar.expert/explorer/testnet/tx/';

interface SubmitBody {
  config?: ActivationConfig;
  signedXdr?: string;
}

/**
 * Submit the signed activation transaction to the network.
 *
 * Real implementation: submit `signedXdr` to Horizon and return the resulting hash, mapping a
 * failed claim predicate to "expired" and any other failure to the generic error. For now it
 * waits to mimic settlement and honours the `simulate` override.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ code: 'failed', message: 'invalid request body' }, { status: 400 });
  }

  if (!body.signedXdr) {
    return NextResponse.json(
      { code: 'failed', message: 'missing signed transaction' },
      { status: 400 },
    );
  }

  const simulate = body.config?.simulate;
  if (simulate === 'expired') {
    return NextResponse.json({ code: 'expired' }, { status: 410 });
  }
  if (simulate === 'failed') {
    return NextResponse.json({ code: 'failed' }, { status: 502 });
  }

  // Mimic network settlement so the processing state is visible.
  await new Promise((resolve) => setTimeout(resolve, 1400));

  const txHash = randomBytes(32).toString('hex');
  return NextResponse.json({ txHash, explorerUrl: `${EXPLORER_TX}${txHash}` });
}
