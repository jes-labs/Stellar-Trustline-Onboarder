import type { ApprovalResult } from '@trustline-onboarder/core';

/**
 * Idempotency + replay protection for `/tx-approve`.
 *
 * Approvals are keyed by the transaction hash (stable across signing — signatures don't change a
 * transaction's hash). Re-submitting the same transaction returns the cached result rather than
 * re-signing or re-recording the audit trail, so a single authorization request can never be
 * turned into two distinct issuer authorizations.
 */
export class ApprovalCache {
  private readonly results = new Map<string, ApprovalResult>();

  get(txHash: string): ApprovalResult | undefined {
    return this.results.get(txHash);
  }

  remember(txHash: string, result: ApprovalResult): ApprovalResult {
    this.results.set(txHash, result);
    return result;
  }

  get size(): number {
    return this.results.size;
  }
}
