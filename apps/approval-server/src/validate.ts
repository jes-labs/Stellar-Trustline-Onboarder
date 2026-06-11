import type { Transaction } from '@stellar/stellar-sdk';

/**
 * Operations the approval server is willing to co-sign. Anything else means the transaction does
 * more than the onboarding flow allows and must be rejected — the issuer signature is a
 * high-value capability and must never be applied to an arbitrary transaction.
 */
const ALLOWED_OPS = new Set([
  'beginSponsoringFutureReserves',
  'changeTrust',
  'endSponsoringFutureReserves',
  'claimClaimableBalance',
  'setTrustLineFlags',
  'createClaimableBalance',
]);

// An onboarding transaction is a handful of operations. A generous ceiling rejects anything
// pathological before the issuer signature is even considered.
const MAX_OPERATIONS = 50;

export interface ValidationOk {
  ok: true;
  /** Trustors the issuer is being asked to authorize (subject to a compliance check). */
  authorizedTrustors: string[];
}
export interface ValidationError {
  ok: false;
  reason: string;
}
export type ValidationResult = ValidationOk | ValidationError;

/**
 * Validate that a transaction is a legitimate onboarding transaction for `issuer`:
 *  - every operation is in the allowed set;
 *  - any operation sourced by the issuer is a `setTrustLineFlags` that only sets the AUTHORIZED
 *    flag (never clawback or other flags) for the issuer's own asset;
 *  - returns the list of trustors being authorized so the caller can run a compliance check.
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

  const authorizedTrustors: string[] = [];

  for (const op of tx.operations) {
    if (!ALLOWED_OPS.has(op.type)) {
      return { ok: false, reason: `disallowed operation: ${op.type}` };
    }

    const opSource = op.source ?? tx.source;

    if (op.type === 'setTrustLineFlags') {
      // The issuer authorization must come from the issuer.
      if (op.source !== issuer) {
        return {
          ok: false,
          reason: `setTrustLineFlags must be sourced by the issuer (${issuer}), got ${op.source}`,
        };
      }
      if (op.asset.getIssuer() !== issuer) {
        return { ok: false, reason: "setTrustLineFlags must target the issuer's own asset" };
      }
      // Only the AUTHORIZED flag may be set; clawback/other flags are not part of onboarding.
      if (op.flags.clawbackEnabled || op.flags.authorizedToMaintainLiabilities) {
        return { ok: false, reason: 'only the AUTHORIZED flag may be set during onboarding' };
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

  return { ok: true, authorizedTrustors };
}
