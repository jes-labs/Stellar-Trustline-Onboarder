import { describe, expect, it } from 'vitest';
import { isStatusScreen, type StatusContext, statusDescriptor } from './statusScreens';
import type { Screen } from './types';

const ctx: StatusContext = { asset: 'EURC', platform: 'Acme', walletName: 'Freighter' };

describe('isStatusScreen', () => {
  it('is true for status screens and false for form screens', () => {
    for (const s of [
      'approve',
      'processing',
      'success',
      'failed',
      'kyc',
      'no-wallet',
    ] as Screen[]) {
      expect(isStatusScreen(s)).toBe(true);
    }
    for (const s of ['welcome', 'selectAsset', 'connect', 'review'] as Screen[]) {
      expect(isStatusScreen(s)).toBe(false);
    }
  });
});

describe('statusDescriptor', () => {
  it('returns null for the non-status (form) screens', () => {
    for (const s of ['welcome', 'selectAsset', 'connect', 'review'] as Screen[]) {
      expect(statusDescriptor(s, ctx)).toBeNull();
    }
  });

  it('describes success with the asset and a return-to-platform action', () => {
    const d = statusDescriptor('success', ctx);
    expect(d?.tone).toBe('success');
    expect(d?.title).toContain('EURC');
    expect(d?.detail).toBe('balance');
    expect(d?.primary?.action).toBe('returnToPlatform');
    expect(d?.primary?.label).toContain('Acme');
  });

  it('interpolates context into the approve and kyc copy', () => {
    expect(statusDescriptor('approve', ctx)?.body).toContain('Freighter');
    const kyc = statusDescriptor('kyc', ctx);
    expect(kyc?.body).toContain('Acme');
    expect(kyc?.body).toContain('EURC');
    expect(kyc?.primary?.action).toBe('continueKyc');
  });

  it('marks processing as progress and approve as pulsing', () => {
    expect(statusDescriptor('processing', ctx)?.progress).toBe(true);
    expect(statusDescriptor('approve', ctx)?.pulse).toBe(true);
  });
});
