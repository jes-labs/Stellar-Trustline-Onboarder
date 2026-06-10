/**
 * @trustline-onboarder/sdk — adopter-facing SDK (stub).
 *
 * Full implementation lands in Phase 3. The intended surface:
 *   - detect(account, asset): { hasTrustline, authorized }
 *   - startOnboarding(params): { mode: 'redirect', url } | { mode: 'direct', tx }
 *   - buildOnboardingTx(request): BuiltTransaction  (delegates to @trustline-onboarder/core)
 *   - verifyActivation(account, asset): boolean
 */

export const SDK_VERSION = '0.0.0';
