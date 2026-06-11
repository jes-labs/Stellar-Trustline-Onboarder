import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ChainError, submitActivationTx } from '../../../../lib/chain';
import { isLiveConfigured } from '../../../../lib/server-config';
import type { ActivationConfig } from '../../../../lib/types';

export const runtime = 'nodejs';

const SIMULATED_EXPLORER = 'https://stellar.expert/explorer/testnet/tx/';

interface SubmitBody {
  config?: ActivationConfig;
  signedXdr?: string;
}

/**
 * Submit the signed activation transaction to the network and return its hash. When the chain is
 * not configured, waits to mimic settlement and returns a placeholder hash.
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

  // QA previews of the network-time edge states.
  const simulate = body.config?.simulate;
  if (simulate === 'expired') return NextResponse.json({ code: 'expired' }, { status: 410 });
  if (simulate === 'failed') return NextResponse.json({ code: 'failed' }, { status: 502 });

  if (!isLiveConfigured()) {
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const txHash = randomBytes(32).toString('hex');
    return NextResponse.json({ txHash, explorerUrl: `${SIMULATED_EXPLORER}${txHash}` });
  }

  try {
    return NextResponse.json(await submitActivationTx(body.signedXdr));
  } catch (err) {
    if (err instanceof ChainError) {
      const status = err.code === 'expired' ? 410 : 502;
      return NextResponse.json({ code: err.code }, { status });
    }
    return NextResponse.json({ code: 'failed' }, { status: 500 });
  }
}
