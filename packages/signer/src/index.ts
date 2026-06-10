/**
 * @trustline-onboarder/signer — issuer signing adapters.
 *
 * The approval server depends on the {@link Signer} interface only, so the issuer's real key
 * stays behind a KMS/HSM in production and never lives in the server process.
 */

export { KmsSigner, type KmsSignerConfig } from './kms';
export { LocalSigner } from './local';
export type { Signer } from './signer';
