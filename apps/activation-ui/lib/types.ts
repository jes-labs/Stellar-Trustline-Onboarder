/** Every screen the activation page can show, keyed by a single string. */
export type Screen =
  | 'welcome'
  | 'selectAsset'
  | 'connect'
  | 'review'
  | 'approve'
  | 'processing'
  | 'success'
  | 'failed'
  | 'kyc'
  | 'rejected'
  | 'expired'
  | 'no-wallet';

/**
 * A concrete asset the user is activating: a code plus the specific issuer that mints it. The
 * code alone is ambiguous (many issuers mint "USDC"), so the issuer is what the trustline points
 * at. `regulated` (issuer AUTH_REQUIRED) is informational for the UI; the build route re-checks
 * it against Horizon before choosing how to build.
 */
export interface SelectedAsset {
  code: string;
  issuer: string;
  regulated: boolean;
}

/** One row in the asset picker, as returned by `/api/activation/assets`. */
export interface AssetOption {
  code: string;
  issuer: string;
  /** AUTH_REQUIRED — needs the issuer's approval to activate, so not self-serviceable here. */
  regulated: boolean;
  /** Total trustlines on this asset, for ranking and a sense of which issuer is "the" one. */
  holders: number;
  /** Home domain from the asset's stellar.toml link, when present. */
  domain?: string;
}

/** The edge outcomes a backend can surface, named to match their screens. */
export type ActivationErrorCode = 'failed' | 'kyc' | 'rejected' | 'expired' | 'no-wallet';

/**
 * Per-session configuration. An exchange or broker sets these on the redirect URL; the page
 * reads them server-side and passes them down. Everything except the asset code has a sensible
 * default so the page still renders if a param is missing.
 */
export interface ActivationConfig {
  /** Asset code shown throughout the flow, e.g. "EURC". */
  assetCode: string;
  /** Pending amount to claim, as a display string. Empty when there is nothing to claim. */
  amount: string;
  /** Name of the platform the user is withdrawing from. */
  platform: string;
  /** Recipient account (G...). Falls back to a demo address when absent. */
  destination?: string;
  /** Asset issuer account (G...). */
  issuer?: string;
  /** Claimable balance id, when the flow is a claim rather than a plain trustline. */
  balanceId?: string;
  /** Where the "Return to platform" button sends the user. */
  returnUrl?: string;
  /** URL of the broker's logo for the top-bar slot. */
  brokerLogoUrl?: string;
  /** Hex override for the primary brand color. */
  primaryColor?: string;
  /**
   * Forces a backend outcome, for previewing edge states by URL during QA. Ignored unless set.
   */
  simulate?: 'failed' | 'kyc' | 'rejected' | 'expired' | 'no-wallet';
}
