import type { ActivationConfig, SelectedAsset } from './types';

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
  /** The chosen asset (code + issuer). Null only in the URL-fixed path before a pick is needed. */
  asset: SelectedAsset | null;
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
  /** Open the wallet modal and return the user's address and the chosen wallet's name. */
  connect(): Promise<{ address: string; walletName: string }>;
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
 * Default backend. The work is split exactly where it belongs: connecting a wallet and signing
 * happen in the browser (via {@link connectWallet}/{@link signTransactionXdr}); building, issuer
 * approval, and submission go through the Next API routes, which keep the sponsor key, approval
 * URL, and Horizon config off the client.
 *
 *   build (server)  → returns the transaction already signed by the sponsor (and, for regulated
 *                     assets, the issuer via the approval server)
 *   sign  (browser) → the connected wallet adds the user's signature
 *   submit (server) → submits to Horizon and returns the real hash
 *
 * In live mode the account first authenticates via SEP-10 and the session token is sent on the
 * build request. When `config.simulate` is set the chain is bypassed entirely so QA can preview
 * the edge screens by URL with no wallet — see {@link simulate}.
 */
export class HttpBackend implements ActivationBackend {
  async connect(): Promise<{ address: string; walletName: string }> {
    const { connectWallet } = await import('./walletKit');
    return connectWallet();
  }

  async activate(input: ActivateInput): Promise<ActivationResult> {
    if (input.config.simulate) return this.simulate(input);

    const { config, asset, address, onSubmitting, signal } = input;

    // In live mode, authenticate the account via SEP-10 and bind the build request to it.
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (LIVE) headers.authorization = `Bearer ${await this.authenticate(address)}`;

    // Server builds the transaction and runs the issuer approval (SEP-8) for regulated assets,
    // then signs as the sponsor. KYC and compliance outcomes come back here. It returns the XDR
    // the wallet still needs to add the user's signature to.
    const buildRes = await fetch('/api/activation/build', {
      method: 'POST',
      headers,
      body: JSON.stringify({ config, asset, address }),
      signal,
    });
    if (!buildRes.ok) throw await toActivationError(buildRes);
    const build = (await buildRes.json()) as BuildResponse;

    // The connected wallet adds the user's signature. This is the approval the user sees.
    const { signTransactionXdr } = await import('./walletKit');
    const signedXdr = await signTransactionXdr(build.xdr, address);
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
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

  /** QA-only path: drive the routes' `simulate` override without touching a wallet or the chain. */
  private async simulate(input: ActivateInput): Promise<ActivationResult> {
    const { config, asset, address, onSubmitting, signal } = input;
    if (config.simulate === 'no-wallet') throw new ActivationError('no-wallet');

    const buildRes = await fetch('/api/activation/build', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, asset, address }),
      signal,
    });
    if (!buildRes.ok) throw await toActivationError(buildRes);

    await delay(2400, signal);
    onSubmitting();

    const submitRes = await fetch('/api/activation/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, signedXdr: 'SIMULATED' }),
      signal,
    });
    if (!submitRes.ok) throw await toActivationError(submitRes);
    return (await submitRes.json()) as ActivationResult;
  }

  // SEP-10: fetch a challenge (proxied to the approval server), sign it with the connected wallet,
  // and exchange it for a session token bound to this account.
  private async authenticate(address: string): Promise<string> {
    const challengeRes = await fetch(`/api/auth/challenge?account=${encodeURIComponent(address)}`);
    if (!challengeRes.ok) throw new ActivationError('failed', 'could not start authentication');
    const challenge = (await challengeRes.json()) as { transaction: string };

    const { signTransactionXdr } = await import('./walletKit');
    const signedChallenge = await signTransactionXdr(challenge.transaction, address);

    const tokenRes = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transaction: signedChallenge }),
    });
    if (!tokenRes.ok) throw new ActivationError('failed', 'authentication failed');
    return ((await tokenRes.json()) as { token: string }).token;
  }
}
