/**
 * Shared domain types for the Trustline Onboarder.
 *
 * This module is pure: it imports only TypeScript types, never SDK runtime values,
 * so it can be consumed by the server, the UI, and the SDK without pulling in a network layer.
 */

/** The three onboarding mechanisms defined by the standard. */
export type Mechanism = 'claimable' | 'authorize' | 'intermediate';

/** Whether the asset enforces issuer authorization (AUTH_REQUIRED) or not. */
export type AssetProfile = 'regulated' | 'unregulated';

/** A classic Stellar asset: a 1–12 char code plus the issuing account. */
export interface AssetRef {
  code: string;
  issuer: string;
}

/**
 * A description of a single operation in a built transaction.
 * Emitted alongside the XDR so callers (and tests) can assert the exact
 * operation sequence and per-op source without decoding XDR.
 */
export interface OperationDescriptor {
  /** The operation kind, e.g. `'changeTrust'`, `'setTrustLineFlags'`. */
  type: string;
  /** The op-level source account (Gxxx), when one is set. */
  source?: string;
}

/**
 * The output of every mechanism builder: an unsigned transaction (XDR) plus the
 * metadata a caller needs to collect signatures and (for regulated assets) hand it
 * to the approval server.
 */
export interface BuiltTransaction {
  /** The unsigned transaction envelope, base64-encoded. */
  xdr: string;
  /** The network passphrase this transaction is built for. */
  network: string;
  /** Accounts whose signatures are required before submission, in no particular order. */
  requiredSigners: string[];
  /**
   * The onboarding mechanism this transaction implements. Omitted for issuer admin
   * transactions (freeze, clawback), which are not an onboarding flow.
   */
  mechanism?: Mechanism;
  /** The ordered operation descriptors (see {@link OperationDescriptor}). */
  operations: OperationDescriptor[];
  /**
   * When set, the operation at this index is an issuer authorization
   * (`setTrustLineFlags`) that the approval server must validate and sign.
   * Absent for unregulated flows.
   */
  issuerAuthOpIndex?: number;
}

/** SEP-8-style approval statuses returned by the approval server. */
export type ApprovalStatus = 'success' | 'revised' | 'pending' | 'action_required' | 'rejected';

/** The approval server's response to a `/tx-approve` request. */
export interface ApprovalResult {
  status: ApprovalStatus;
  /** The approved or revised transaction (base64 XDR). Present for `success`/`revised`. */
  tx?: string;
  /** Human-readable detail (e.g. why a request is pending or rejected). */
  message?: string;
  /** A machine-readable error code, when `status === 'rejected'`. */
  error?: string;
}

/** Common options accepted by the mechanism builders. */
export interface BuildOptions {
  /** Per-operation fee in stroops. Defaults to a testnet-safe value. */
  fee?: string;
  /** Transaction timeout in seconds. Defaults to 180. */
  timeoutSeconds?: number;
}
