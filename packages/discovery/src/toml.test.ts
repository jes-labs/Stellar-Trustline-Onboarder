import { describe, expect, it } from 'vitest';
import { buildStellarToml, parseStellarToml } from './toml';
import type { StellarToml } from './types';

const ISSUER = 'GDLALBZ46ZAHMCVXB2RRXALXJZ52I3H6CEWX5EX7JKY2TZZTCWHCUHG7';

describe('buildStellarToml / parseStellarToml', () => {
  it('round-trips a full document', () => {
    const doc: StellarToml = {
      networkPassphrase: 'Test SDF Network ; September 2015',
      onboarding: {
        server: 'https://issuer.example/onboard',
        mechanisms: ['claimable', 'authorize'],
        profiles: ['regulated', 'unregulated'],
      },
      currencies: [
        {
          code: 'EURC',
          issuer: ISSUER,
          regulated: true,
          approvalServer: 'https://issuer.example/tx-approve',
          approvalCriteria: 'An authorized trustline is required.',
        },
      ],
    };
    expect(parseStellarToml(buildStellarToml(doc))).toEqual(doc);
  });

  it('emits scalar keys before the CURRENCIES tables', () => {
    const toml = buildStellarToml({
      networkPassphrase: 'Test SDF Network ; September 2015',
      onboarding: { server: '/onboard', mechanisms: ['claimable'], profiles: ['unregulated'] },
      currencies: [{ code: 'USDC', issuer: ISSUER, regulated: false }],
    });
    expect(toml.indexOf('ONBOARDING_SERVER')).toBeLessThan(toml.indexOf('[[CURRENCIES]]'));
  });

  it('omits the onboarding service when absent', () => {
    const parsed = parseStellarToml(
      buildStellarToml({ currencies: [{ code: 'USDC', issuer: ISSUER, regulated: false }] }),
    );
    expect(parsed.onboarding).toBeUndefined();
    expect(parsed.currencies).toHaveLength(1);
  });

  it('drops unknown mechanisms and profiles', () => {
    const toml = [
      'ONBOARDING_SERVER = "/onboard"',
      'ONBOARDING_MECHANISMS = ["claimable", "telepathy"]',
      'ONBOARDING_PROFILES = ["regulated", "imaginary"]',
    ].join('\n');
    const parsed = parseStellarToml(toml);
    expect(parsed.onboarding?.mechanisms).toEqual(['claimable']);
    expect(parsed.onboarding?.profiles).toEqual(['regulated']);
  });

  it('skips currency entries missing a code or issuer', () => {
    const toml = [
      '[[CURRENCIES]]',
      'code = "EURC"',
      `issuer = "${ISSUER}"`,
      '',
      '[[CURRENCIES]]',
      'code = "BROKEN"',
    ].join('\n');
    const parsed = parseStellarToml(toml);
    expect(parsed.currencies).toHaveLength(1);
    expect(parsed.currencies[0]?.code).toBe('EURC');
  });
});
