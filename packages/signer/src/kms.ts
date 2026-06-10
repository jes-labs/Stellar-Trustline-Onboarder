import type { Transaction } from '@stellar/stellar-sdk';
import type { Signer } from './signer';

/**
 * Production signing adapter (stub). The issuer key never lives in the server process: this
 * adapter holds only a KMS/HSM handle and calls out to sign the transaction hash, then attaches
 * the resulting ed25519 signature with the issuer's signature hint.
 *
 * Implemented in the hardening phase. The shape below is the intended surface.
 */
export interface KmsSignerConfig {
  /** The issuer account this KMS key corresponds to (Gxxx). */
  issuerPublicKey: string;
  /** Provider-specific key handle (e.g. a KMS key ARN or HSM slot reference). */
  keyHandle: string;
}

export class KmsSigner implements Signer {
  constructor(private readonly config: KmsSignerConfig) {}

  publicKey(): string {
    return this.config.issuerPublicKey;
  }

  async sign(_tx: Transaction): Promise<Transaction> {
    throw new Error(
      'KmsSigner is not implemented yet. Use LocalSigner for development; the KMS/HSM adapter ' +
        'lands in the hardening phase.',
    );
  }
}
