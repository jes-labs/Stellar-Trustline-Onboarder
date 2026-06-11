/**
 * @trustline-onboarder/signer — issuer signing adapters.
 *
 * The approval server depends on the {@link Signer} interface only, so the issuer's real key
 * stays behind an HSM or signing service in production and never lives in the server process.
 */

export { ExternalSigner, type ExternalSignerConfig, type SignHash } from './external';
export { LocalSigner } from './local';
export type { Signer } from './signer';
