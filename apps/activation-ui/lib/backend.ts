import { DEMO_ADDRESS } from './config';
import type { ActivationConfig, ActivationErrorCode, WalletId } from './types';

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
 * never builds or submits a transaction itself. Connecting and signing happen in the browser;
 * building, approval, and submission go through the Next API routes.
 */
export interface ActivationBackend {
  /** Connect a wallet and return the user's address. Throws `no-wallet` when none is available. */
  connect(walletId: WalletId): Promise<{ address: string }>;
  /** Build, request approval for, sign, and submit the activation transaction. */
  activate(input: ActivateInput): Promise<ActivationResult>;
}

// In a live deployment the server is configured for the chain and this enables the real wallet.
// Left unset, the whole flow simulates so the app runs locally with no wallet or secrets.
const LIVE = process.env.NEXT_PUBLIC_ACTIVATION_MODE === 'live';

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

interface BuildResponse {
  xdr: string;
  networkPassphrase: string;
  simulated?: boolean;
}

/**
 * Default backend. Connecting and signing use Freighter in the browser; building, approval, and
 * submission go through the Next API routes. When the deployment is not live (or the server is
 * simulating), the wallet steps are stood in for so the flow still runs end to end.
 */
export class HttpBackend implements ActivationBackend {
  async connect(_walletId: WalletId): Promise<{ address: string }> {
    if (!LIVE) {
      await new Promise((r) => setTimeout(r, 400));
      return { address: DEMO_ADDRESS };
    }
    const freighter = await import('@stellar/freighter-api');
    const connection = await freighter.isConnected();
    if (!connection.isConnected) throw new ActivationError('no-wallet');
    const access = await freighter.requestAccess();
    if (access.error) throw new ActivationError('failed', access.error.message);
    return { address: access.address };
  }

  async activate(input: ActivateInput): Promise<ActivationResult> {
    const { config, address, onSubmitting, signal } = input;

    if (config.simulate === 'no-wallet') throw new ActivationError('no-wallet');

    const buildRes = await fetch('/api/activation/build', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, address }),
      signal,
    });
    if (!buildRes.ok) throw await toActivationError(buildRes);
    const build = (await buildRes.json()) as BuildResponse;

    const signedXdr = await this.sign(build, address, signal);

    onSubmitting();
    const submitRes = await fetch('/api/activation/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, signedXdr }),
      signal,
    });
    if (!submitRes.ok) throw await toActivationError(submitRes);
    return (await submitRes.json()) as ActivationResult;
  }

  // The approve step. With a real transaction the wallet popup is the wait; otherwise we pause to
  // stand in for it.
  private async sign(build: BuildResponse, address: string, signal: AbortSignal): Promise<string> {
    if (!LIVE || build.simulated) {
      await delay(2400, signal);
      return build.xdr;
    }
    const freighter = await import('@stellar/freighter-api');
    const signed = await freighter.signTransaction(build.xdr, {
      networkPassphrase: build.networkPassphrase,
      address,
    });
    if (signed.error) throw new ActivationError('failed', signed.error.message);
    return signed.signedTxXdr;
  }
}
