import type { Transaction } from '@stellar/stellar-sdk';

/**
 * The signing boundary for issuer operations. The approval server depends only on this
 * interface, so the issuer's real key can live behind a KMS/HSM in production and never inside
 * the server process. Implementations add a signature to the transaction for the issuer account.
 */
export interface Signer {
  /** The issuer account this signer controls (Gxxx). */
  publicKey(): string;
  /**
   * Add this signer's signature to `tx` (for the given network the tx was built against) and
   * return it. May be async so KMS/HSM adapters can call out.
   */
  sign(tx: Transaction): Promise<Transaction>;
}
