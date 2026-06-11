import { DEMO_ADDRESS } from './config';
import type { ActivationConfig, WalletId } from './types';

/** The edge states a backend can surface, named to match their screens. */
export type ActivationErrorCode = 'failed' | 'kyc' | 'rejected' | 'expired' | 'no-wallet';

export class ActivationError extends Error {
  constructor(
    readonly code: ActivationErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ActivationError';
  }
}

export interface ActivationResult {
  txHash: string;
  explorerUrl: string;
}

export interface ActivateInput {
  config: ActivationConfig;
  walletId: WalletId;
  address: string;
  /** Called once the wallet has approved and we move from "approve" to "processing". */
  onSubmitting: () => void;
  signal: AbortSignal;
}

/**
 * The seam between the UI and the chain. The page drives the flow against this interface and
 * never builds or submits a transaction itself. A real implementation keeps the three steps
 * exactly where they belong: connect and sign in the browser, build and submit on the server.
 */
export interface ActivationBackend {
  /** Connect a wallet and return the user's address. Throws `no-wallet` when none is available. */
  connect(walletId: WalletId): Promise<{ address: string }>;
  /** Build, request approval for, sign, and submit the activation transaction. */
  activate(input: ActivateInput): Promise<ActivationResult>;
}

const KNOWN_CODES: ReadonlySet<string> = new Set([
  'failed',
  'kyc',
  'rejected',
  'expired',
  'no-wallet',
]);

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/** Turn a non-OK API response into an {@link ActivationError} with a screen code. */
async function toActivationError(res: Response): Promise<ActivationError> {
  let code = 'failed';
  try {
    const body = (await res.json()) as { code?: string };
    if (body.code && KNOWN_CODES.has(body.code)) code = body.code;
  } catch {
    // keep the generic code
  }
  return new ActivationError(code as ActivationErrorCode);
}

/**
 * Default backend. Connecting and signing happen here in the browser; building, approval, and
 * submission go through Next API routes. The wallet pieces are stubbed (a demo address and an
 * approval pause) until the Freighter integration lands; the server routes simulate the chain.
 */
export class HttpBackend implements ActivationBackend {
  async connect(_walletId: WalletId): Promise<{ address: string }> {
    // TODO: replace with @stellar/freighter-api (getPublicKey); throw ActivationError('no-wallet')
    // when no wallet is injected.
    await new Promise((r) => setTimeout(r, 400));
    return { address: DEMO_ADDRESS };
  }

  async activate(input: ActivateInput): Promise<ActivationResult> {
    const { config, address, walletId, onSubmitting, signal } = input;

    if (config.simulate === 'no-wallet') throw new ActivationError('no-wallet');

    // Server builds the unsigned transaction and runs the issuer approval (SEP-8) for regulated
    // assets. KYC and compliance outcomes come back here.
    const buildRes = await fetch('/api/activation/build', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, address, walletId }),
      signal,
    });
    if (!buildRes.ok) throw await toActivationError(buildRes);
    const { xdr } = (await buildRes.json()) as { xdr: string };

    // Wallet-approval window. The real build signs `xdr` with the connected wallet here.
    await delay(2400, signal);
    onSubmitting();
    const signedXdr = xdr;

    // Server submits to Horizon. Network outcomes (failure, expired claim) come back here.
    const submitRes = await fetch('/api/activation/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, signedXdr }),
      signal,
    });
    if (!submitRes.ok) throw await toActivationError(submitRes);
    return (await submitRes.json()) as ActivationResult;
  }
}
