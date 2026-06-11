import { Account, Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import { buildAuthorize } from '@trustline-onboarder/core';
import { describe, expect, it } from 'vitest';
import { OnboardingError } from './errors';
import { signWithSponsor, sponsorPublicKey } from './sponsor';
import type { SponsorConfig } from './types';

/** A local, unsubmitted authorize transaction — built offline with a zero-sequence account. */
function localTx(user: Keypair, sponsor: string): Transaction {
  const built = buildAuthorize(
    {
      asset: { code: 'TEST', issuer: Keypair.random().publicKey() },
      profile: 'unregulated',
      user: user.publicKey(),
      sponsor,
    },
    new Account(user.publicKey(), '0'),
    Networks.TESTNET,
  );
  return new Transaction(built.xdr, Networks.TESTNET);
}

describe('sponsorPublicKey', () => {
  it('derives the key for every config kind', () => {
    const kp = Keypair.random();
    expect(sponsorPublicKey({ kind: 'keypair', secret: kp.secret() })).toBe(kp.publicKey());
    expect(
      sponsorPublicKey({ kind: 'callback', publicKey: 'GCALLBACK', sign: async (x) => x }),
    ).toBe('GCALLBACK');
    expect(
      sponsorPublicKey({
        kind: 'signer',
        signer: { publicKey: () => 'GSIGNER', sign: async (t) => t },
      }),
    ).toBe('GSIGNER');
  });

  it('throws no-sponsor when none is configured', () => {
    expect(() => sponsorPublicKey(undefined)).toThrowError(OnboardingError);
    try {
      sponsorPublicKey(undefined);
    } catch (err) {
      expect((err as OnboardingError).code).toBe('no-sponsor');
    }
  });
});

describe('signWithSponsor', () => {
  it('adds a signature with the keypair kind', async () => {
    const user = Keypair.random();
    const sponsor = Keypair.random();
    const tx = localTx(user, sponsor.publicKey());
    const before = tx.signatures.length;
    await signWithSponsor({ kind: 'keypair', secret: sponsor.secret() }, tx, Networks.TESTNET);
    expect(tx.signatures.length).toBe(before + 1);
  });

  it('adds a signature with the callback kind', async () => {
    const user = Keypair.random();
    const sponsor = Keypair.random();
    const tx = localTx(user, sponsor.publicKey());
    const config: SponsorConfig = {
      kind: 'callback',
      publicKey: sponsor.publicKey(),
      sign: async (xdr) => {
        const t = new Transaction(xdr, Networks.TESTNET);
        t.sign(sponsor);
        return t.toXDR();
      },
    };
    const signed = await signWithSponsor(config, tx, Networks.TESTNET);
    expect(signed.signatures.length).toBe(1);
  });

  it('throws no-sponsor when none is configured', async () => {
    const tx = localTx(Keypair.random(), Keypair.random().publicKey());
    await expect(signWithSponsor(undefined, tx, Networks.TESTNET)).rejects.toBeInstanceOf(
      OnboardingError,
    );
  });
});
