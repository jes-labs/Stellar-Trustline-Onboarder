import { Operation } from '@stellar/stellar-sdk';
import { toAsset } from '../network';
import type { PlannedOp } from '../tx';
import type { AssetRef } from '../types';

/**
 * Shared planned-operation factories used by more than one mechanism.
 * Centralizing them keeps the exact operation shapes identical across mechanisms A and C.
 */

/** `changeTrust` sourced by the account establishing the trustline. */
export function plannedChangeTrust(asset: AssetRef, trustor: string, limit?: string): PlannedOp {
  return {
    op: Operation.changeTrust({ asset: toAsset(asset), limit, source: trustor }),
    type: 'changeTrust',
    source: trustor,
  };
}

/**
 * Issuer authorization for a regulated asset: `setTrustLineFlags` setting the AUTHORIZED flag
 * on the trustor's trustline. Sourced by the issuer and signed by the approval server.
 */
export function plannedIssuerAuthorize(asset: AssetRef, trustor: string): PlannedOp {
  return {
    op: Operation.setTrustLineFlags({
      trustor,
      asset: toAsset(asset),
      flags: { authorized: true },
      source: asset.issuer,
    }),
    type: 'setTrustLineFlags',
    source: asset.issuer,
  };
}
