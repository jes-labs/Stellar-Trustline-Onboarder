import type { Transaction } from '@stellar/stellar-sdk';

/**
 * Operations the approval server is willing to co-sign. Anything else means the transaction does
 * more than the onboarding flow allows and must be rejected: the issuer signature is a
 * high-value capability and must never be applied to an arbitrary transaction.
 *
 * Note createClaimableBalance is deliberately absent. That is the sender side of a claim; a
 * transaction the issuer authorizes only ever claims an existing balance.
 */
const ALLOWED_OPS = new Set([
  'beginSponsoringFutureReserves',
  'changeTrust',
  'endSponsoringFutureReserves',
  'claimClaimableBalance',
  'setTrustLineFlags',
]);

// An onboarding transaction is a handful of operations. A generous ceiling rejects anything
// pathological before the issuer signature is even considered.
const MAX_OPERATIONS = 50;

export interface ValidationOk {
  ok: true;
  /** Trustors the issuer is being asked to authorize (subject to a compliance check). */
  authorizedTrustors: string[];
  /** The account paying the reserve, when the transaction sponsors one. */
  sponsor?: string;
  /** The account whose reserve is sponsored. */
  sponsoredAccount?: string;
}
export interface ValidationError {
  ok: false;
  reason: string;
}
export type ValidationResult = ValidationOk | ValidationError;

/**
 * Validate that a transaction is a legitimate onboarding transaction for `issuer` before the
 * issuer signature is applied:
 *  - every operation is in the allowed set;
 *  - the issuer is the source of at most one operation, a `setTrustLineFlags` that sets only the
 *    AUTHORIZED flag on the issuer's own asset;
 *  - the issuer is not the transaction's own source account;
 *  - the transaction has an expiry and a sane operation count.
 *
 * Returns the trustors being authorized (for the KYC check) and any sponsor (for the record).
 */
export function validateOnboardingTx(tx: Transaction, issuer: string): ValidationResult {
  if (tx.operations.length > MAX_OPERATIONS) {
    return { ok: false, reason: `too many operations: ${tx.operations.length}` };
  }

  // Require an expiry. The issuer's signature must not be replayable forever, and every builder
  // here sets a timeout. A missing or zero maxTime means the transaction never expires.
  const maxTime = tx.timeBounds?.maxTime;
  if (!maxTime || maxTime === '0') {
    return { ok: false, reason: 'transaction must have a maxTime (expiry) set' };
  }

  // The issuer authorizes; it does not source the onboarding transaction itself.
  if (tx.source === issuer) {
    return { ok: false, reason: 'issuer must not be the transaction source account' };
  }

  const authorizedTrustors: string[] = [];
  let sponsor: string | undefined;
  let sponsoredAccount: string | undefined;
  let issuerAuthOps = 0;

  for (const op of tx.operations) {
    if (!ALLOWED_OPS.has(op.type)) {
      return { ok: false, reason: `disallowed operation: ${op.type}` };
    }

    const opSource = op.source ?? tx.source;

    if (op.type === 'beginSponsoringFutureReserves') {
      sponsor = opSource;
      sponsoredAccount = op.sponsoredId;
    }

    if (op.type === 'setTrustLineFlags') {
      issuerAuthOps += 1;
      if (issuerAuthOps > 1) {
        return { ok: false, reason: 'at most one setTrustLineFlags is allowed' };
      }
      if (op.source !== issuer) {
        return {
          ok: false,
          reason: `setTrustLineFlags must be sourced by the issuer (${issuer}), got ${op.source}`,
        };
      }
      if (op.asset.getIssuer() !== issuer) {
        return { ok: false, reason: "setTrustLineFlags must target the issuer's own asset" };
      }
      // Only the AUTHORIZED flag may be touched, and it must be set. Any other flag being set or
      // cleared means the transaction is doing more than authorizing.
      if (
        op.flags.authorizedToMaintainLiabilities !== undefined ||
        op.flags.clawbackEnabled !== undefined
      ) {
        return { ok: false, reason: 'only the AUTHORIZED flag may be changed during onboarding' };
      }
      if (op.flags.authorized !== true) {
        return { ok: false, reason: 'issuer authorization must set authorized=true' };
      }
      authorizedTrustors.push(op.trustor);
    } else if (opSource === issuer) {
      // The issuer must not be the source of any non-authorization operation.
      return {
        ok: false,
        reason: `issuer may only sign setTrustLineFlags, but is the source of ${op.type}`,
      };
    }
  }

  return { ok: true, authorizedTrustors, sponsor, sponsoredAccount };
}
