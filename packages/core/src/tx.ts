import {
  type Account,
  type FeeBumpTransaction,
  Horizon,
  Transaction,
  TransactionBuilder,
  type xdr,
} from '@stellar/stellar-sdk';
import type { BuildOptions, BuiltTransaction, Mechanism, OperationDescriptor } from './types';

/**
 * A testnet-safe per-operation fee (stroops). The network base fee is 100; this leaves
 * generous headroom for surge pricing without being wasteful.
 */
export const DEFAULT_FEE = '10000';

/** Default transaction validity window, in seconds. */
export const DEFAULT_TIMEOUT_SECONDS = 180;

/**
 * Internal representation of one planned operation: the SDK operation object plus the
 * metadata needed to emit a truthful {@link OperationDescriptor}. Building the XDR and the
 * descriptors from the same value keeps them in sync.
 */
export interface PlannedOp {
  op: xdr.Operation;
  type: string;
  source?: string;
}

/** Project a list of planned operations into descriptors (for logging and assertions). */
export function describe(ops: PlannedOp[]): OperationDescriptor[] {
  return ops.map(({ type, source }) => (source ? { type, source } : { type }));
}

/**
 * Assemble a list of planned operations into an unsigned {@link BuiltTransaction}.
 *
 * `source` provides the fee account and sequence number. In unit tests this can be a local
 * `new Account(pubkey, '0')` — no network is required to build (only to submit).
 */
export function assemble(params: {
  source: Account;
  network: string;
  mechanism: Mechanism;
  operations: PlannedOp[];
  requiredSigners: string[];
  issuerAuthOpIndex?: number;
  options?: BuildOptions;
}): BuiltTransaction {
  const builder = new TransactionBuilder(params.source, {
    fee: params.options?.fee ?? DEFAULT_FEE,
    networkPassphrase: params.network,
  });
  for (const planned of params.operations) {
    builder.addOperation(planned.op);
  }
  builder.setTimeout(params.options?.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS);
  const tx = builder.build();
  return {
    xdr: tx.toXDR(),
    network: params.network,
    requiredSigners: [...new Set(params.requiredSigners)],
    mechanism: params.mechanism,
    operations: describe(params.operations),
    issuerAuthOpIndex: params.issuerAuthOpIndex,
  };
}

/** Re-hydrate a {@link Transaction} from a {@link BuiltTransaction}. */
export function toTransaction(built: BuiltTransaction): Transaction {
  return new Transaction(built.xdr, built.network);
}

/** Parse a base64 transaction envelope against a network passphrase. */
export function parseTransaction(envelopeXdr: string, network: string): Transaction {
  return new Transaction(envelopeXdr, network);
}

/**
 * The claimable balance id a `createClaimableBalance` transaction will produce, derived
 * locally from the built (but not yet submitted) transaction. `opIndex` is the index of the
 * `createClaimableBalance` operation within the transaction.
 */
export function predictBalanceId(tx: Transaction, opIndex = 0): string {
  return tx.getClaimableBalanceId(opIndex);
}

/** Build a Horizon client for a given Horizon URL. */
export function horizon(horizonUrl: string): Horizon.Server {
  return new Horizon.Server(horizonUrl);
}

/** Load an account (fee source / sequence) from Horizon. */
export function loadAccount(horizonUrl: string, accountId: string): Promise<Account> {
  return horizon(horizonUrl).loadAccount(accountId) as unknown as Promise<Account>;
}

/** Submit a signed transaction to Horizon. */
export function submit(
  horizonUrl: string,
  tx: Transaction | FeeBumpTransaction,
): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
  return horizon(horizonUrl).submitTransaction(tx);
}
