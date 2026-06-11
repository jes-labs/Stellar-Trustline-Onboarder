import { Account, Keypair, Networks } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import type { AssetRef } from '../types';
import { buildAuthorize } from './authorize';
import { buildClawback, buildFreeze } from './mica';

const NETWORK = Networks.TESTNET;

const issuer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey();
const user = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2)).publicKey();
const sponsor = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey();

const asset: AssetRef = { code: 'EURC', issuer };
const account = (pubkey: string) => new Account(pubkey, '0');

describe('mechanism A — authorize', () => {
  it('unregulated: sponsored trustline, no issuer op', () => {
    const built = buildAuthorize(
      { asset, profile: 'unregulated', user, sponsor },
      account(user),
      NETWORK,
    );
    expect(built.operations).toEqual([
      { type: 'beginSponsoringFutureReserves', source: sponsor },
      { type: 'changeTrust', source: user },
      { type: 'endSponsoringFutureReserves', source: user },
    ]);
    expect(built.issuerAuthOpIndex).toBeUndefined();
    expect(built.requiredSigners.sort()).toEqual([sponsor, user].sort());
  });

  it('regulated: appends issuer authorization and flags its index', () => {
    const built = buildAuthorize(
      { asset, profile: 'regulated', user, sponsor },
      account(user),
      NETWORK,
    );
    expect(built.operations).toEqual([
      { type: 'beginSponsoringFutureReserves', source: sponsor },
      { type: 'changeTrust', source: user },
      { type: 'endSponsoringFutureReserves', source: user },
      { type: 'setTrustLineFlags', source: issuer },
    ]);
    expect(built.issuerAuthOpIndex).toBe(3);
    expect(built.requiredSigners.sort()).toEqual([sponsor, user, issuer].sort());
  });

  it('preauthorize flag does not change the operation sequence (no draft-CAP dependency)', () => {
    const plain = buildAuthorize(
      { asset, profile: 'regulated', user, sponsor },
      account(user),
      NETWORK,
    );
    const pre = buildAuthorize(
      { asset, profile: 'regulated', user, sponsor, preauthorize: true },
      account(user),
      NETWORK,
    );
    expect(pre.operations).toEqual(plain.operations);
  });
});

describe('MiCA operations', () => {
  it('freeze clears authorization via a single issuer-sourced setTrustLineFlags', () => {
    const built = buildFreeze({ asset, trustor: user }, account(issuer), NETWORK);
    expect(built.operations).toEqual([{ type: 'setTrustLineFlags', source: issuer }]);
    expect(built.requiredSigners).toEqual([issuer]);
    // Admin actions are not an onboarding mechanism.
    expect(built.mechanism).toBeUndefined();
  });

  it('clawback is a single issuer-sourced clawback op', () => {
    const built = buildClawback({ asset, from: user, amount: '5' }, account(issuer), NETWORK);
    expect(built.operations).toEqual([{ type: 'clawback', source: issuer }]);
    expect(built.requiredSigners).toEqual([issuer]);
    expect(built.mechanism).toBeUndefined();
  });
});
