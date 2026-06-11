import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

describe('parseConfig', () => {
  it('applies defaults when params are absent', () => {
    const c = parseConfig({});
    expect(c.assetCode).toBe('USDC');
    expect(c.amount).toBe('250.00');
    expect(c.platform).toBe('your exchange');
    expect(c.issuer).toBeUndefined();
    expect(c.simulate).toBeUndefined();
    expect(c.primaryColor).toBeUndefined();
  });

  it('uppercases the asset code and trims values', () => {
    expect(parseConfig({ asset: 'eurc' }).assetCode).toBe('EURC');
    expect(parseConfig({ platform: '  Acme  ' }).platform).toBe('Acme');
  });

  it('takes the first value when a param repeats', () => {
    expect(parseConfig({ asset: ['eurc', 'usdc'] }).assetCode).toBe('EURC');
  });

  it('keeps a valid hex primary color and drops an invalid one', () => {
    expect(parseConfig({ primary: '#4338CA' }).primaryColor).toBe('#4338CA');
    expect(parseConfig({ primary: '#abc' }).primaryColor).toBe('#abc');
    expect(parseConfig({ primary: 'red' }).primaryColor).toBeUndefined();
    expect(parseConfig({ primary: '4338CA' }).primaryColor).toBeUndefined();
  });

  it('allow-lists simulate values', () => {
    expect(parseConfig({ simulate: 'kyc' }).simulate).toBe('kyc');
    expect(parseConfig({ simulate: 'expired' }).simulate).toBe('expired');
    expect(parseConfig({ simulate: 'nonsense' }).simulate).toBeUndefined();
  });

  it('passes through optional account params', () => {
    const c = parseConfig({
      destination: 'GDEST',
      issuer: 'GISSUER',
      balanceId: 'BAL1',
      returnUrl: 'https://x.example',
      logo: 'https://x.example/l.svg',
    });
    expect(c.destination).toBe('GDEST');
    expect(c.issuer).toBe('GISSUER');
    expect(c.balanceId).toBe('BAL1');
    expect(c.returnUrl).toBe('https://x.example');
    expect(c.brokerLogoUrl).toBe('https://x.example/l.svg');
  });

  it('treats blank/whitespace values as absent', () => {
    const c = parseConfig({ platform: '   ', issuer: '' });
    expect(c.platform).toBe('your exchange');
    expect(c.issuer).toBeUndefined();
  });
});
