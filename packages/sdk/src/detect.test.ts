import type { AssetRef } from '@trustline-onboarder/core';
import { describe, expect, it } from 'vitest';
import { readTrustline } from './detect';

const asset: AssetRef = { code: 'EURC', issuer: 'GISSUER' };

describe('readTrustline', () => {
  it('reports no trustline when the asset is absent', () => {
    const state = readTrustline([{ asset_type: 'native', balance: '100' }], asset);
    expect(state).toEqual({ hasTrustline: false, authorized: false });
  });

  it('reads balance and authorization from a matching line', () => {
    const state = readTrustline(
      [
        {
          asset_code: 'EURC',
          asset_issuer: 'GISSUER',
          balance: '250.0000000',
          is_authorized: true,
        },
      ],
      asset,
    );
    expect(state).toEqual({ hasTrustline: true, authorized: true, balance: '250.0000000' });
  });

  it('treats a line with no authorization flag as authorized (unregulated asset)', () => {
    const state = readTrustline(
      [{ asset_code: 'EURC', asset_issuer: 'GISSUER', balance: '0' }],
      asset,
    );
    expect(state.authorized).toBe(true);
  });

  it('reports a frozen trustline as unauthorized', () => {
    const state = readTrustline(
      [{ asset_code: 'EURC', asset_issuer: 'GISSUER', balance: '10', is_authorized: false }],
      asset,
    );
    expect(state.authorized).toBe(false);
  });

  it('does not match a same-code asset from a different issuer', () => {
    const state = readTrustline(
      [{ asset_code: 'EURC', asset_issuer: 'GOTHER', balance: '10', is_authorized: true }],
      asset,
    );
    expect(state.hasTrustline).toBe(false);
  });
});
