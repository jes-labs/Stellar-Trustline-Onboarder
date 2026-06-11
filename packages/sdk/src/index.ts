/**
 * @trustline-onboarder/sdk
 *
 * The adopter-facing surface for wallets and exchanges: detect whether a destination can receive
 * an asset, start onboarding (by redirect or by building the transaction directly), and verify
 * that activation completed. This is the client side of the standard.
 */

export {
  type ActivationParams,
  buildActivationUrl,
  parseActivationParams,
} from './deeplink';
export { detect, readTrustline, type TrustlineState } from './detect';
export {
  buildOnboardingTx,
  type OnboardingRequest,
  planOnboarding,
  type StartOnboardingInput,
  type StartOnboardingResult,
  startOnboarding,
} from './onboard';
export { type VerifyOptions, verifyActivation } from './verify';
