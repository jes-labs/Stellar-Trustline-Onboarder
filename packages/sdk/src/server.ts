/**
 * `@trustline-onboarder/sdk/server` — broker/server conveniences.
 *
 * Helpers for wiring a bring-your-own sponsor, including from a KMS-backed
 * `@trustline-onboarder/signer`, so the sponsor secret can stay behind an HSM in production.
 */

import type { Signer } from '@trustline-onboarder/signer';
import type { SignerLike, SponsorConfig } from './types';

export type { Signer } from '@trustline-onboarder/signer';
export { LocalSigner } from '@trustline-onboarder/signer';

/** A sponsor backed by a raw secret seed (development / simple deployments). */
export function sponsorFromSecret(secret: string): SponsorConfig {
  return { kind: 'keypair', secret };
}

/**
 * A sponsor backed by a {@link Signer} (e.g. a KMS adapter), so the key never lives in process.
 * The signer's `publicKey()` becomes the sponsor account.
 */
export function sponsorFromSigner(signer: Signer | SignerLike): SponsorConfig {
  return { kind: 'signer', signer };
}
