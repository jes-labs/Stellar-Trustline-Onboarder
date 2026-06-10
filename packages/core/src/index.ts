/**
 * @trustline-onboarder/core
 *
 * Shared domain types and Stellar transaction builders for the three onboarding mechanisms:
 *   A — authorize the trustline (hold before receiving)
 *   B — temporary intermediate account (optional)
 *   C — claimable balance (the universal default)
 *
 * Every builder returns a {@link BuiltTransaction}: unsigned XDR plus the metadata needed to
 * collect signatures and (for regulated assets) route the transaction through the approval
 * server. Builders are pure and can be exercised without a network by passing a local
 * `new Account(pubkey, '0')` as the source.
 */

// Mechanism A — authorize the trustline
export { type AuthorizeParams, buildAuthorize } from './mechanisms/authorize';
// Mechanism C — claimable balance
export {
  buildClaimRegulated,
  buildClaimUnregulated,
  buildCreateClaimableBalance,
  type ClaimParams,
  type CreateClaimableBalanceParams,
} from './mechanisms/claimable';
// Mechanism B — intermediate account (optional, not implemented)
export {
  buildCleanupIntermediate,
  buildCreateIntermediate,
  buildForwardFromIntermediate,
  type IntermediateParams,
} from './mechanisms/intermediate';
// MiCA operations (regulated profile)
export {
  buildClawback,
  buildFreeze,
  type ClawbackParams,
  type FreezeParams,
} from './mechanisms/mica';
export * from './network';
export { wrapSponsored } from './sponsorship';
export {
  assemble,
  DEFAULT_FEE,
  DEFAULT_TIMEOUT_SECONDS,
  describe,
  horizon,
  loadAccount,
  type PlannedOp,
  parseTransaction,
  predictBalanceId,
  submit,
  toTransaction,
} from './tx';
export * from './types';
