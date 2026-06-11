import { StrKey, type Transaction, xdr } from '@stellar/stellar-sdk';
import type { Signer } from './signer';

/**
 * Signs the 32-byte transaction hash with the issuer's ed25519 key and returns the 64-byte
 * signature. This is the only thing that touches the private key, so it is where an HSM or a
 * remote signing service is plugged in.
 *
 * Note: AWS KMS does not offer ed25519 signing, so the realistic backings are an HSM that does,
 * or a small signing service in front of one. This signer is agnostic to which.
 */
export type SignHash = (hash: Buffer) => Promise<Buffer> | Buffer;

export interface ExternalSignerConfig {
  /** The issuer account this key corresponds to (G...). */
  issuerPublicKey: string;
  signHash: SignHash;
}

/**
 * Production signer. The issuer's private key never lives in this process: the key stays in an
 * HSM or signing service, reached through {@link ExternalSignerConfig.signHash}. The class only
 * knows the public key (to derive the signature hint) and how to ask for a signature.
 */
export class ExternalSigner implements Signer {
  private readonly hint: Buffer;

  constructor(private readonly config: ExternalSignerConfig) {
    // Validate the address up front and cache the 4-byte hint (the last 4 bytes of the raw key).
    this.hint = StrKey.decodeEd25519PublicKey(config.issuerPublicKey).subarray(-4);
  }

  publicKey(): string {
    return this.config.issuerPublicKey;
  }

  async sign(tx: Transaction): Promise<Transaction> {
    const signature = await this.config.signHash(tx.hash());
    tx.addDecoratedSignature(
      new xdr.DecoratedSignature({ hint: this.hint, signature: Buffer.from(signature) }),
    );
    return tx;
  }
}
