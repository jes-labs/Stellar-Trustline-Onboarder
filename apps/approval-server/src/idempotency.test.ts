import { describe, expect, it } from 'vitest';
import { ApprovalCache } from './idempotency';

const ok = (tx: string) => ({ status: 'success' as const, tx });

describe('ApprovalCache', () => {
  it('returns a remembered result', () => {
    const cache = new ApprovalCache();
    cache.remember('hash1', ok('xdr1'));
    expect(cache.get('hash1')).toEqual(ok('xdr1'));
    expect(cache.get('missing')).toBeUndefined();
  });

  it('expires entries past the TTL', () => {
    let clock = 1000;
    const cache = new ApprovalCache({ ttlMs: 500, now: () => clock });
    cache.remember('hash1', ok('xdr1'));
    clock = 1400;
    expect(cache.get('hash1')).toEqual(ok('xdr1')); // still within TTL
    clock = 1600;
    expect(cache.get('hash1')).toBeUndefined(); // expired
    expect(cache.size).toBe(0);
  });

  it('evicts the oldest entries past capacity', () => {
    const cache = new ApprovalCache({ maxEntries: 2 });
    cache.remember('a', ok('1'));
    cache.remember('b', ok('2'));
    cache.remember('c', ok('3'));
    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBeUndefined(); // oldest, evicted
    expect(cache.get('b')).toEqual(ok('2'));
    expect(cache.get('c')).toEqual(ok('3'));
  });
});
