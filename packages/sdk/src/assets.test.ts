import { describe, expect, it } from 'vitest';
import { type Predicate, parseAssetString, predicateSatisfied } from './assets';

describe('parseAssetString', () => {
  it('parses a classic asset and rejects native', () => {
    expect(parseAssetString('USDC:GISSUER')).toEqual({ code: 'USDC', issuer: 'GISSUER' });
    expect(parseAssetString('native')).toBeNull();
    expect(parseAssetString('garbage')).toBeNull();
  });
});

describe('predicateSatisfied', () => {
  const NOW = 1_000_000; // unix seconds

  it('is true for unconditional and undefined predicates', () => {
    expect(predicateSatisfied({ unconditional: true }, NOW)).toBe(true);
    expect(predicateSatisfied(undefined, NOW)).toBe(true);
  });

  it('honors abs_before_epoch as a deadline', () => {
    expect(predicateSatisfied({ abs_before_epoch: String(NOW + 100) }, NOW)).toBe(true);
    expect(predicateSatisfied({ abs_before_epoch: String(NOW - 100) }, NOW)).toBe(false);
  });

  it('honors abs_before as an ISO deadline', () => {
    const future = new Date((NOW + 100) * 1000).toISOString();
    const past = new Date((NOW - 100) * 1000).toISOString();
    expect(predicateSatisfied({ abs_before: future }, NOW)).toBe(true);
    expect(predicateSatisfied({ abs_before: past }, NOW)).toBe(false);
  });

  it('composes not / and / or', () => {
    const open: Predicate = { unconditional: true };
    const closed: Predicate = { abs_before_epoch: String(NOW - 1) };
    expect(predicateSatisfied({ not: closed }, NOW)).toBe(true);
    expect(predicateSatisfied({ and: [open, closed] }, NOW)).toBe(false);
    expect(predicateSatisfied({ or: [open, closed] }, NOW)).toBe(true);
  });

  it('treats a bare rel_before as claimable (no reference time)', () => {
    expect(predicateSatisfied({ rel_before: '120' }, NOW)).toBe(true);
  });
});
