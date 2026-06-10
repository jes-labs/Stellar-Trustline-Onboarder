import { type Account, Operation } from '@stellar/stellar-sdk';
import { toAsset } from '../network';
import { assemble, type PlannedOp } from '../tx';
import type { AssetRef, BuildOptions, BuiltTransaction } from '../types';

/**
 * MiCA operations for the regulated profile. Each is a single issuer-sourced operation; the
 * issuer account is also the transaction source. The approval server records every one of these
 * in its audit trail with actor, timestamp, and reason.
 */

export interface FreezeParams {
  asset: AssetRef;
  /** The holder whose trustline is being frozen. */
  trustor: string;
}

/**
 * Freeze a holder by clearing the AUTHORIZED flag on their trustline (requires AUTH_REVOCABLE).
 * The balance is locked but not removed.
 */
export function buildFreeze(
  params: FreezeParams,
  issuerAccount: Account,
  network: string,
  options?: BuildOptions,
): BuiltTransaction {
  const op: PlannedOp = {
    op: Operation.setTrustLineFlags({
      trustor: params.trustor,
      asset: toAsset(params.asset),
      flags: { authorized: false },
      source: params.asset.issuer,
    }),
    type: 'setTrustLineFlags',
    source: params.asset.issuer,
  };
  return assemble({
    source: issuerAccount,
    network,
    mechanism: 'authorize',
    operations: [op],
    requiredSigners: [params.asset.issuer],
    options,
  });
}

export interface ClawbackParams {
  asset: AssetRef;
  /** The holder the asset is being recovered from. */
  from: string;
  amount: string;
}

/**
 * Clawback (CAP-35): recover assets from a holder under regulatory order. Requires the holder's
 * trustline to have been authorized with clawback enabled and the issuer to have clawback enabled.
 */
export function buildClawback(
  params: ClawbackParams,
  issuerAccount: Account,
  network: string,
  options?: BuildOptions,
): BuiltTransaction {
  const op: PlannedOp = {
    op: Operation.clawback({
      asset: toAsset(params.asset),
      from: params.from,
      amount: params.amount,
      source: params.asset.issuer,
    }),
    type: 'clawback',
    source: params.asset.issuer,
  };
  return assemble({
    source: issuerAccount,
    network,
    mechanism: 'authorize',
    operations: [op],
    requiredSigners: [params.asset.issuer],
    options,
  });
}
