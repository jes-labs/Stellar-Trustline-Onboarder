import type { AssetProfile, Mechanism } from '@trustline-onboarder/core';

/** A regulated-or-not asset entry in a stellar.toml `[[CURRENCIES]]` table. */
export interface OnboardingCurrency {
  code: string;
  issuer: string;
  regulated: boolean;
  /** SEP-8 approval server URL, present for regulated assets. */
  approvalServer?: string;
  approvalCriteria?: string;
}

/**
 * The onboarding service an issuer advertises, mirroring how SEP-24 advertises a transfer
 * server. Carried in the top-level `ONBOARDING_*` keys of stellar.toml.
 */
export interface OnboardingService {
  /** The onboarding endpoint (the approval server for regulated assets). */
  server: string;
  mechanisms: Mechanism[];
  profiles: AssetProfile[];
}

/** The subset of a stellar.toml this standard reads or writes. */
export interface StellarToml {
  networkPassphrase?: string;
  onboarding?: OnboardingService;
  currencies: OnboardingCurrency[];
}
