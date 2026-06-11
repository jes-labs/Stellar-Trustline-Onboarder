import { describe, expect, it } from 'vitest';
import { buildRedirectUrl } from './redirect';
import type { StartOnboardingParams } from './types';

const ASSET = { code: 'EURC', issuer: 'GISSUER' };
const DEST = 'GUSERDESTINATION';

describe('buildRedirectUrl', () => {
  it('points at /withdraw on the service origin with the required params', () => {
    const url = new URL(
      buildRedirectUrl('https://activate.example', { asset: ASSET, destination: DEST }),
    );
    expect(url.origin).toBe('https://activate.example');
    expect(url.pathname).toBe('/withdraw');
    expect(url.searchParams.get('asset')).toBe('EURC');
    expect(url.searchParams.get('issuer')).toBe('GISSUER');
    expect(url.searchParams.get('destination')).toBe(DEST);
  });

  it('includes optional params only when provided', () => {
    const bare = new URL(
      buildRedirectUrl('https://x.example', { asset: ASSET, destination: DEST }),
    );
    expect(bare.searchParams.has('amount')).toBe(false);
    expect(bare.searchParams.has('balanceId')).toBe(false);

    const full: StartOnboardingParams = {
      asset: ASSET,
      destination: DEST,
      amount: '120.00',
      balanceId: 'BAL123',
      returnUrl: 'https://broker.example/done',
      platform: 'Acme',
      branding: { logo: 'https://broker.example/logo.svg', primary: '#4338CA' },
    };
    const url = new URL(buildRedirectUrl('https://x.example', full));
    expect(url.searchParams.get('amount')).toBe('120.00');
    expect(url.searchParams.get('balanceId')).toBe('BAL123');
    expect(url.searchParams.get('returnUrl')).toBe('https://broker.example/done');
    expect(url.searchParams.get('platform')).toBe('Acme');
    expect(url.searchParams.get('logo')).toBe('https://broker.example/logo.svg');
    expect(url.searchParams.get('primary')).toBe('#4338CA');
  });
});
