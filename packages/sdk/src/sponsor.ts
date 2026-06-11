import { Keypair, Transaction } from '@stellar/stellar-sdk';
import { OnboardingError } from './errors';
import type { SponsorConfig } from './types';

const NO_SPONSOR = 'no sponsor configured — use redirect mode or provide a sponsor';

/** The sponsor's public key, known locally for every config kind (needed at build time). */
export function sponsorPublicKey(sponsor: SponsorConfig | undefined): string {
  if (!sponsor) throw new OnboardingError('no-sponsor', NO_SPONSOR);
  switch (sponsor.kind) {
    case 'keypair':
      return Keypair.fromSecret(sponsor.secret).publicKey();
    case 'signer':
      return sponsor.signer.publicKey();
    case 'callback':
      return sponsor.publicKey;
  }
}

/**
 * Add the sponsor's signature to an already-user-signed transaction. Stellar signatures are
 * additive, so this layers onto the existing envelope and returns it ready to submit.
 */
export async function signWithSponsor(
  sponsor: SponsorConfig | undefined,
  tx: Transaction,
  network: string,
): Promise<Transaction> {
  if (!sponsor) throw new OnboardingError('no-sponsor', NO_SPONSOR);
  switch (sponsor.kind) {
    case 'keypair':
      tx.sign(Keypair.fromSecret(sponsor.secret));
      return tx;
    case 'signer':
      return sponsor.signer.sign(tx);
    case 'callback': {
      const signedXdr = await sponsor.sign(tx.toXDR());
      return new Transaction(signedXdr, network);
    }
  }
}
