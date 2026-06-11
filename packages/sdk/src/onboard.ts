import type { Account } from '@stellar/stellar-sdk';
import {
  type AssetProfile,
  type AssetRef,
  type BuildOptions,
  type BuiltTransaction,
  buildAuthorize,
  buildClaimRegulated,
  buildClaimUnregulated,
  loadAccount,
  type Mechanism,
  type NetworkConfig,
} from '@trustline-onboarder/core';
import { type ActivationParams, buildActivationUrl } from './deeplink';

/**
 * Everything needed to build an onboarding transaction. The recipient is the user being
 * onboarded and is the transaction source; the sponsor pays the trustline reserve.
 */
export interface OnboardingRequest {
  network: NetworkConfig;
  mechanism: Mechanism;
  profile: AssetProfile;
  asset: AssetRef;
  recipient: string;
  sponsor: string;
  /** Required when mechanism is `claimable`. */
  balanceId?: string;
  limit?: string;
  options?: BuildOptions;
}

/**
 * Route a request to the right core builder. Pure: pass a loaded (or local) account as the
 * source, so the operation sequence can be asserted without a network.
 */
export function planOnboarding(req: OnboardingRequest, source: Account): BuiltTransaction {
  const network = req.network.networkPassphrase;
  switch (req.mechanism) {
    case 'claimable': {
      if (!req.balanceId) {
        throw new Error('claimable onboarding requires a balanceId');
      }
      const params = {
        asset: req.asset,
        recipient: req.recipient,
        sponsor: req.sponsor,
        balanceId: req.balanceId,
        limit: req.limit,
      };
      return req.profile === 'regulated'
        ? buildClaimRegulated(params, source, network, req.options)
        : buildClaimUnregulated(params, source, network, req.options);
    }
    case 'authorize':
      return buildAuthorize(
        {
          asset: req.asset,
          profile: req.profile,
          user: req.recipient,
          sponsor: req.sponsor,
          limit: req.limit,
        },
        source,
        network,
        req.options,
      );
    case 'intermediate':
      throw new Error('mechanism B (intermediate account) is not implemented');
  }
}

/** Load the recipient account from Horizon and build the onboarding transaction. */
export async function buildOnboardingTx(req: OnboardingRequest): Promise<BuiltTransaction> {
  const source = await loadAccount(req.network.horizonUrl, req.recipient);
  return planOnboarding(req, source);
}

export type StartOnboardingInput =
  | { mode: 'redirect'; activationUrl: string; params: ActivationParams }
  | { mode: 'direct'; request: OnboardingRequest };

export type StartOnboardingResult =
  | { mode: 'redirect'; url: string }
  | { mode: 'direct'; tx: BuiltTransaction };

/**
 * Start onboarding. A platform that does not control the user's wallet redirects to the
 * activation page; one that does build the transaction directly.
 */
export async function startOnboarding(input: StartOnboardingInput): Promise<StartOnboardingResult> {
  if (input.mode === 'redirect') {
    return { mode: 'redirect', url: buildActivationUrl(input.activationUrl, input.params) };
  }
  return { mode: 'direct', tx: await buildOnboardingTx(input.request) };
}
