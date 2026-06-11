import { describe, expect, it } from 'vitest';
import { type ActivationParams, buildActivationUrl, parseActivationParams } from './deeplink';

const BASE = 'https://activate.example/withdraw';

describe('buildActivationUrl / parseActivationParams', () => {
  it('round-trips the params it was given', () => {
    const params: ActivationParams = {
      asset: 'EURC',
      amount: '120.00',
      platform: 'Acme Exchange',
      destination: 'GA3PS3MMTR75ZNXC6YMRWLVDCWT6NRJ4P5DAFAXUPZ4NNXKNYFFZY2D6',
      issuer: 'GDLALBZ46ZAHMCVXB2RRXALXJZ52I3H6CEWX5EX7JKY2TZZTCWHCUHG7',
      balanceId: '0'.repeat(72),
      returnUrl: 'https://acme.example/done?ref=abc',
      primary: '#4338CA',
    };
    const url = buildActivationUrl(BASE, params);
    expect(parseActivationParams(url)).toEqual(params);
  });

  it('omits empty and undefined params from the URL', () => {
    const url = buildActivationUrl(BASE, { asset: 'USDC', amount: '' });
    expect(url).toBe('https://activate.example/withdraw?asset=USDC');
  });

  it('encodes values that need it', () => {
    const url = buildActivationUrl(BASE, {
      asset: 'USDC',
      platform: 'Acme & Co',
      primary: '#4F46E5',
    });
    expect(url).toContain('platform=Acme+%26+Co');
    expect(url).toContain('primary=%234F46E5');
  });

  it('parses from a bare query string and a full URL alike', () => {
    expect(parseActivationParams('?asset=EURC&amount=5').asset).toBe('EURC');
    expect(parseActivationParams('asset=EURC&amount=5').amount).toBe('5');
    expect(parseActivationParams('https://x/withdraw?asset=EURC').asset).toBe('EURC');
  });

  it('defaults a missing asset to an empty string for the caller to validate', () => {
    expect(parseActivationParams('amount=5').asset).toBe('');
  });
});
