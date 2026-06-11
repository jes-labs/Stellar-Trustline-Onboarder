/**
 * `@trustline-onboarder/sdk/client` — wallet/browser conveniences.
 *
 * A thin wrapper over the build → sign → submit sequence, taking the wallet's own signing
 * function. Browser-safe: it pulls in no server-only code.
 */

import type { TrustlineOnboarder } from './onboarder';
import type { OnboardRequest, SettledActivation } from './types';

/** Signs a transaction XDR with the user's wallet and returns the signed XDR. */
export type SignXdr = (xdr: string) => Promise<string>;

/**
 * Run the full recipient flow: build the activation transaction, have the wallet sign it, and
 * submit it (the configured sponsor co-signs inside {@link TrustlineOnboarder.submit}).
 *
 * @example
 *   await activateWithWallet(onboarder, { asset, account }, (xdr) =>
 *     kit.signTransaction(xdr, { address }).then((r) => r.signedTxXdr),
 *   );
 */
export async function activateWithWallet(
  onboarder: TrustlineOnboarder,
  req: OnboardRequest,
  sign: SignXdr,
): Promise<SettledActivation> {
  const plan = await onboarder.buildOnboardingTx(req);
  const signedXdr = await sign(plan.tx);
  return onboarder.submit(signedXdr);
}
