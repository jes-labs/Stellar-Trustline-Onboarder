import {
  Account,
  Keypair,
  Networks,
  Operation,
  type Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { ExternalSigner } from './external';
import { LocalSigner } from './local';

const issuer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));

function makeTx(): Transaction {
  const source = new Account(issuer.publicKey(), '1');
  return new TransactionBuilder(source, { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
    .setTimeout(180)
    .build();
}

describe('ExternalSigner', () => {
  // The HSM stand-in: sign the hash with the issuer keypair.
  const signer = new ExternalSigner({
    issuerPublicKey: issuer.publicKey(),
    signHash: (hash) => Buffer.from(issuer.sign(hash)),
  });

  it('produces a signature the network will accept', async () => {
    const tx = makeTx();
    await signer.sign(tx);
    expect(tx.signatures).toHaveLength(1);
    const sig = tx.signatures[0]?.signature();
    expect(sig && issuer.verify(tx.hash(), sig)).toBe(true);
  });

  it('attaches the issuer signature hint', async () => {
    const tx = makeTx();
    await signer.sign(tx);
    expect(tx.signatures[0]?.hint()).toEqual(issuer.signatureHint());
  });

  it('is byte-identical to signing with the local key in process', async () => {
    const viaExternal = makeTx();
    await signer.sign(viaExternal);

    const viaLocal = makeTx();
    await new LocalSigner(issuer.secret()).sign(viaLocal);

    expect(viaExternal.signatures[0]?.signature()).toEqual(viaLocal.signatures[0]?.signature());
  });

  it('rejects a malformed issuer address at construction', () => {
    expect(
      () =>
        new ExternalSigner({
          issuerPublicKey: 'not-a-key',
          signHash: async () => Buffer.alloc(64),
        }),
    ).toThrow();
  });
});
