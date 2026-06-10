import { Account, Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import type { AssetRef } from '../types';
import {
  buildClaimRegulated,
  buildClaimUnregulated,
  buildCreateClaimableBalance,
} from './claimable';

const NETWORK = Networks.TESTNET;

// Deterministic, network-free accounts for the builders.
const issuerKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
const recipientKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));
const sponsorKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3));
const senderKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 4));

const issuer = issuerKp.publicKey();
const recipient = recipientKp.publicKey();
const sponsor = sponsorKp.publicKey();
const sender = senderKp.publicKey();

const asset: AssetRef = { code: 'DEMO', issuer };

// A local source account — no network needed to build a transaction.
const account = (pubkey: string) => new Account(pubkey, '0');

const types = (ops: { type: string }[]) => ops.map((o) => o.type);

describe('mechanism C — createClaimableBalance', () => {
  it('builds a single unconditional createClaimableBalance op signed by the sender', () => {
    const built = buildCreateClaimableBalance(
      { asset, amount: '100', recipient, sender },
      account(sender),
      NETWORK,
    );
    expect(types(built.operations)).toEqual(['createClaimableBalance']);
    expect(built.requiredSigners).toEqual([sender]);
    expect(built.mechanism).toBe('claimable');
    // The XDR must parse back to a valid transaction on the right network.
    expect(() => new Transaction(built.xdr, NETWORK)).not.toThrow();
  });

  it('produces a deterministic, claimable balance id from the built transaction', () => {
    const built = buildCreateClaimableBalance(
      { asset, amount: '100', recipient, sender },
      new Account(sender, '42'),
      NETWORK,
    );
    const tx = new Transaction(built.xdr, NETWORK);
    const id = tx.getClaimableBalanceId(0);
    expect(id).toMatch(/^[0-9a-f]{72}$/);
  });
});

describe('mechanism C — claim (unregulated)', () => {
  it('builds the exact sponsored-claim sequence with correct op sources', () => {
    const built = buildClaimUnregulated(
      { asset, recipient, sponsor, balanceId: '0'.repeat(72) },
      account(recipient),
      NETWORK,
    );
    expect(built.operations).toEqual([
      { type: 'beginSponsoringFutureReserves', source: sponsor },
      { type: 'changeTrust', source: recipient },
      { type: 'endSponsoringFutureReserves', source: recipient },
      { type: 'claimClaimableBalance', source: recipient },
    ]);
    expect(built.requiredSigners.sort()).toEqual([sponsor, recipient].sort());
    expect(built.issuerAuthOpIndex).toBeUndefined();
  });
});

describe('mechanism C — claim (regulated)', () => {
  it('inserts issuer authorization before the claim and flags its index', () => {
    const built = buildClaimRegulated(
      { asset, recipient, sponsor, balanceId: '0'.repeat(72) },
      account(recipient),
      NETWORK,
    );
    expect(built.operations).toEqual([
      { type: 'beginSponsoringFutureReserves', source: sponsor },
      { type: 'changeTrust', source: recipient },
      { type: 'endSponsoringFutureReserves', source: recipient },
      { type: 'setTrustLineFlags', source: issuer },
      { type: 'claimClaimableBalance', source: recipient },
    ]);
    // The issuer auth op must come immediately before the claim.
    expect(built.issuerAuthOpIndex).toBe(3);
    expect(built.operations[built.issuerAuthOpIndex ?? -1]?.type).toBe('setTrustLineFlags');
    expect(built.requiredSigners.sort()).toEqual([sponsor, recipient, issuer].sort());
  });
});
