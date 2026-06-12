/**
 * @trustline-onboarder/sdk — the adopter-facing SDK for wallets and brokers.
 *
 * One {@link TrustlineOnboarder} serves both personas: a wallet onboards its user into an asset
 * (detect → build → sign → submit), a broker hands a withdrawing user to the hosted page or pushes
 * a claimable balance. The SDK never holds keys and the sponsor is always bring-your-own — see
 * the `/server` and `/client` subpaths for per-persona conveniences.
 */

export { OnboardingError, type OnboardingErrorCode } from './errors';
export { TrustlineOnboarder } from './onboarder';
export { buildRedirectUrl } from './redirect';
export type {
  AssetOption,
  AssetRef,
  ClaimableAsset,
  DetectResult,
  Mechanism,
  NetworkName,
  OnboardingPlan,
  OnboardRequest,
  SendRequest,
  SettledActivation,
  SignerLike,
  SponsorConfig,
  StartOnboardingParams,
  StartOnboardingResult,
  TrustlineOnboarderConfig,
} from './types';

export const SDK_VERSION = '0.1.0';
