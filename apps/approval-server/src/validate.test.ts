import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import {
  buildClaimRegulated,
  buildClaimUnregulated,
  parseTransaction,
} from '@trustline-onboarder/core';
import { describe, expect, it } from 'vitest';
import { validateOnboardingTx } from './validate';

const NETWORK = Networks.TESTNET;
const issuerKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
const recipientKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));
const sponsorKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3));

const issuer = issuerKp.publicKey();
const recipient = recipientKp.publicKey();
const sponsor = sponsorKp.publicKey();
const assetRef = { code: 'EURC', issuer };
const asset = new Asset('EURC', issuer);
const account = (pubkey: string) => new Account(pubkey, '5');

describe('validateOnboardingTx', () => {
  it('accepts a regulated claim and reports the trustor to authorize', () => {
    const built = buildClaimRegulated(
      { asset: assetRef, recipient, sponsor, balanceId: '0'.repeat(72) },
      account(recipient),
      NETWORK,
    );
    const result = validateOnboardingTx(parseTransaction(built.xdr, NETWORK), issuer);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.authorizedTrustors).toEqual([recipient]);
  });

  it('accepts an unregulated claim with no trustor to authorize', () => {
    const built = buildClaimUnregulated(
      { asset: assetRef, recipient, sponsor, balanceId: '0'.repeat(72) },
      account(recipient),
      NETWORK,
    );
    const result = validateOnboardingTx(parseTransaction(built.xdr, NETWORK), issuer);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.authorizedTrustors).toEqual([]);
  });

  it('rejects a transaction that asks the issuer to sign a payment', () => {
    const tx = new TransactionBuilder(account(recipient), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.payment({ source: issuer, destination: recipient, asset, amount: '100' }),
      )
      .setTimeout(180)
      .build();
    const result = validateOnboardingTx(tx, issuer);
    expect(result.ok).toBe(false);
  });

  it('rejects issuer authorization that targets a foreign asset', () => {
    const foreign = new Asset('EURC', sponsor); // same code, different issuer
    const tx = new TransactionBuilder(account(recipient), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.setTrustLineFlags({
          source: issuer,
          trustor: recipient,
          asset: foreign,
          flags: { authorized: true },
        }),
      )
      .setTimeout(180)
      .build();
    const result = validateOnboardingTx(tx, issuer);
    expect(result.ok).toBe(false);
  });

  it('rejects setTrustLineFlags that enables clawback instead of just authorizing', () => {
    const tx = new TransactionBuilder(account(recipient), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.setTrustLineFlags({
          source: issuer,
          trustor: recipient,
          asset,
          flags: { authorized: true, clawbackEnabled: true },
        }),
      )
      .setTimeout(180)
      .build();
    const result = validateOnboardingTx(tx, issuer);
    expect(result.ok).toBe(false);
  });

  it('rejects a transaction with no expiry (maxTime)', () => {
    const tx = new TransactionBuilder(account(recipient), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(Operation.changeTrust({ source: recipient, asset }))
      .setTimeout(0) // TimeoutInfinite: maxTime = 0
      .build();
    const result = validateOnboardingTx(tx, issuer);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/maxTime|expiry/);
  });

  it('rejects a transaction with too many operations', () => {
    const builder = new TransactionBuilder(account(recipient), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    });
    for (let i = 0; i < 51; i++) {
      builder.addOperation(Operation.changeTrust({ source: recipient, asset }));
    }
    const tx = builder.setTimeout(180).build();
    const result = validateOnboardingTx(tx, issuer);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too many operations/);
  });
});
