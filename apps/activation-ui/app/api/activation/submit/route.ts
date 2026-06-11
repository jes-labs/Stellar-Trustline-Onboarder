import { parseTransaction, submit } from '@trustline-onboarder/core';
import { NextResponse } from 'next/server';
import { guard } from '../../../../lib/guard';
import { HORIZON_URL, IS_TESTNET, NETWORK_PASSPHRASE } from '../../../../lib/serverStellar';
import type { ActivationConfig } from '../../../../lib/types';

export const runtime = 'nodejs';

const EXPLORER_TX = IS_TESTNET
  ? 'https://stellar.expert/explorer/testnet/tx/'
  : 'https://stellar.expert/explorer/public/tx/';

interface SubmitBody {
  config?: ActivationConfig;
  signedXdr?: string;
}

/** Horizon surfaces operation result codes here on a failed submission. */
interface HorizonErrorBody {
  extras?: { result_codes?: { transaction?: string; operations?: string[] } };
}

/**
 * Submit the fully-signed activation transaction to Horizon and return its hash.
 *
 * A claim against an expired/unavailable claimable balance maps to the "expired" screen; any
 * other failure maps to the generic error. Both leave the user un-charged for the reserve.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const blocked = guard(request, 10);
  if (blocked) return blocked;

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

  // QA override: preview network edge screens without touching the chain.
  const simulate = body.config?.simulate;
  if (simulate === 'expired') return NextResponse.json({ code: 'expired' }, { status: 410 });
  if (simulate === 'failed') return NextResponse.json({ code: 'failed' }, { status: 502 });
  if (body.signedXdr === 'SIMULATED') {
    const fake = `${'0'.repeat(8)}simulated${'0'.repeat(47)}`.slice(0, 64);
    return NextResponse.json({ txHash: fake, explorerUrl: `${EXPLORER_TX}${fake}` });
  }

  try {
    const tx = parseTransaction(body.signedXdr, NETWORK_PASSPHRASE);
    const result = await submit(HORIZON_URL, tx);
    return NextResponse.json({ txHash: result.hash, explorerUrl: `${EXPLORER_TX}${result.hash}` });
  } catch (err) {
    return NextResponse.json(mapSubmitError(err), { status: 502 });
  }
}

/** Map a Horizon submission failure to a screen code. */
function mapSubmitError(err: unknown): { code: string; message: string } {
  const response = (err as { response?: { data?: HorizonErrorBody } })?.response?.data;
  const opCodes = response?.extras?.result_codes?.operations ?? [];
  // A claim op against a missing/expired balance returns these codes.
  const expired = opCodes.some(
    (c) => c === 'op_does_not_exist' || c === 'op_claimable_balance_not_found',
  );
  if (expired) return { code: 'expired', message: 'claimable balance no longer available' };
  return { code: 'failed', message: 'submission failed' };
}
