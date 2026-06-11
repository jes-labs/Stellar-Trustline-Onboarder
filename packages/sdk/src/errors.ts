/** Why an onboarding step could not complete. */
export type OnboardingErrorCode =
  | 'no-sponsor'
  | 'kyc'
  | 'rejected'
  | 'account-not-found'
  | 'no-approval-server'
  | 'failed';

/**
 * A typed onboarding failure. `kyc` and `rejected` come from the issuer's approval server;
 * `no-sponsor` means a direct build/submit was attempted without a configured sponsor.
 */
export class OnboardingError extends Error {
  constructor(
    readonly code: OnboardingErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OnboardingError';
  }
}
