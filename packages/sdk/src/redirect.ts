import type { StartOnboardingParams } from './types';

/**
 * Build the hosted activation URL (the "Welcome to Stellar" page). The parameter names match
 * what that page reads from its query string, so a broker can hand the user straight to it.
 */
export function buildRedirectUrl(serviceUrl: string, params: StartOnboardingParams): string {
  const url = new URL('/withdraw', serviceUrl);
  const q = url.searchParams;
  q.set('asset', params.asset.code);
  q.set('issuer', params.asset.issuer);
  q.set('destination', params.destination);
  if (params.amount) q.set('amount', params.amount);
  if (params.balanceId) q.set('balanceId', params.balanceId);
  if (params.returnUrl) q.set('returnUrl', params.returnUrl);
  if (params.platform) q.set('platform', params.platform);
  if (params.branding?.logo) q.set('logo', params.branding.logo);
  if (params.branding?.primary) q.set('primary', params.branding.primary);
  return url.toString();
}
