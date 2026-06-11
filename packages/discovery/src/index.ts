/**
 * @trustline-onboarder/discovery
 *
 * Generation and parsing of the onboarding fields in a SEP-1 stellar.toml, plus the resolver a
 * wallet or exchange uses to discover an issuer's onboarding service from its home domain.
 */

export { buildStellarToml, parseStellarToml } from './toml';
export type { OnboardingCurrency, OnboardingService, StellarToml } from './types';
export {
  type ResolveOptions,
  resolveOnboarding,
  STELLAR_TOML_PATH,
  wellKnownUrl,
} from './wellknown';
