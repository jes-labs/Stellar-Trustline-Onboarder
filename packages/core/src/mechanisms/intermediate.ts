import type { Account } from '@stellar/stellar-sdk';
import type { AssetRef, BuildOptions, BuiltTransaction } from '../types';

/**
 * Mechanism B — temporary intermediate account (optional, not the default).
 *
 * A short-lived account pre-configured with trustlines receives the asset and forwards it.
 * This works today but adds funding, forwarding, and cleanup/account-merge complexity, so it is
 * offered for specific custodial setups rather than the default path.
 *
 * Implemented behind the same interface as mechanisms A and C, but the operation builders are
 * not part of the Phase 0/1 critical path. The signatures below are the intended surface.
 */

export interface IntermediateParams {
  asset: AssetRef;
  amount: string;
  recipient: string;
  sponsor: string;
}

function notImplemented(stage: string): never {
  throw new Error(
    `Mechanism B (intermediate account) is not implemented yet: ${stage}. ` +
      'It is an optional, non-default path scheduled after the Phase 0/1 spine.',
  );
}

/** Create and fund the short-lived intermediate account with the required trustlines. */
export function buildCreateIntermediate(
  _params: IntermediateParams,
  _sponsorAccount: Account,
  _network: string,
  _options?: BuildOptions,
): BuiltTransaction {
  return notImplemented('createIntermediate');
}

/** Forward the received asset from the intermediate account to the final recipient. */
export function buildForwardFromIntermediate(
  _params: IntermediateParams,
  _intermediateAccount: Account,
  _network: string,
  _options?: BuildOptions,
): BuiltTransaction {
  return notImplemented('forwardFromIntermediate');
}

/** Clean up (account-merge) the intermediate account once forwarding has settled. */
export function buildCleanupIntermediate(
  _params: IntermediateParams,
  _intermediateAccount: Account,
  _network: string,
  _options?: BuildOptions,
): BuiltTransaction {
  return notImplemented('cleanupIntermediate');
}
