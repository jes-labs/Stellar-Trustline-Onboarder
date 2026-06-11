import { Keypair, type Transaction } from '@stellar/stellar-sdk';
import type { Signer } from './signer';

/**
 * A local-keypair signer for development only: it holds the issuer secret in process memory.
 * Production deployments must use an HSM or signing service instead (see {@link ExternalSigner}).
 */
export class LocalSigner implements Signer {
  private readonly keypair: Keypair;

  constructor(secret: string) {
    this.keypair = Keypair.fromSecret(secret);
  }

  /** Construct from a raw secret seed (Sxxx). */
  static fromSecret(secret: string): LocalSigner {
    return new LocalSigner(secret);
  }

  publicKey(): string {
    return this.keypair.publicKey();
  }

  async sign(tx: Transaction): Promise<Transaction> {
    tx.sign(this.keypair);
    return tx;
  }
}
