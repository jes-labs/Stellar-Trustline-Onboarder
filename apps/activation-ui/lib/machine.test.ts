import { describe, expect, it } from 'vitest';
import { reducer, type State } from './machine';
import type { SelectedAsset } from './types';

const base: State = {
  screen: 'welcome',
  walletName: '',
  address: 'GDEST',
  result: null,
  connecting: false,
  connectError: null,
  asset: null,
  balanceId: null,
  assetLocked: false,
};

const ASSET: SelectedAsset = { code: 'EURC', issuer: 'GISSUER', regulated: false };

describe('reducer — navigation', () => {
  it('getStarted always connects first (so the picker can show pending claims)', () => {
    expect(reducer(base, { type: 'getStarted' }).screen).toBe('connect');
    const locked = { ...base, asset: ASSET, assetLocked: true };
    expect(reducer(locked, { type: 'getStarted' }).screen).toBe('connect');
  });

  it('chooseAsset records the asset (+ optional balanceId) and advances to review', () => {
    const plain = reducer(
      { ...base, screen: 'selectAsset' },
      { type: 'chooseAsset', asset: ASSET },
    );
    expect(plain.asset).toEqual(ASSET);
    expect(plain.balanceId).toBeNull();
    expect(plain.screen).toBe('review');

    const claim = reducer(
      { ...base, screen: 'selectAsset' },
      { type: 'chooseAsset', asset: ASSET, balanceId: 'BAL1' },
    );
    expect(claim.balanceId).toBe('BAL1');
  });

  it('back from connect returns to welcome; back from selectAsset returns to connect', () => {
    expect(reducer({ ...base, screen: 'connect' }, { type: 'back' }).screen).toBe('welcome');
    expect(reducer({ ...base, screen: 'selectAsset' }, { type: 'back' }).screen).toBe('connect');
  });

  it('back from review returns to the picker, or to connect when the asset is locked', () => {
    expect(reducer({ ...base, screen: 'review' }, { type: 'back' }).screen).toBe('selectAsset');
    expect(reducer({ ...base, screen: 'review', assetLocked: true }, { type: 'back' }).screen).toBe(
      'connect',
    );
  });
});

describe('reducer — connection', () => {
  it('connecting sets the flag and clears any prior error', () => {
    const next = reducer({ ...base, connectError: 'old' }, { type: 'connecting' });
    expect(next.connecting).toBe(true);
    expect(next.connectError).toBeNull();
  });

  it('connected goes to the picker, or straight to review when the asset is locked', () => {
    const picker = reducer(
      { ...base, connecting: true },
      { type: 'connected', address: 'GUSER', walletName: 'Freighter' },
    );
    expect(picker.screen).toBe('selectAsset');

    const locked = reducer(
      { ...base, connecting: true, assetLocked: true },
      { type: 'connected', address: 'GUSER', walletName: 'Freighter' },
    );
    expect(locked).toMatchObject({
      address: 'GUSER',
      walletName: 'Freighter',
      connecting: false,
      screen: 'review',
    });
  });

  it('connectFailed keeps the user on connect with an inline message', () => {
    const next = reducer(
      { ...base, screen: 'connect', connecting: true },
      { type: 'connectFailed', message: 'nope' },
    );
    expect(next.screen).toBe('connect');
    expect(next.connecting).toBe(false);
    expect(next.connectError).toBe('nope');
  });
});

describe('reducer — activation outcomes', () => {
  it('edge moves to the named screen and stops connecting', () => {
    const next = reducer({ ...base, connecting: true }, { type: 'edge', screen: 'kyc' });
    expect(next.screen).toBe('kyc');
    expect(next.connecting).toBe(false);
  });

  it('succeeded records the result and shows success', () => {
    const result = { txHash: 'abc', explorerUrl: 'https://x/abc' };
    const next = reducer(base, { type: 'succeeded', result });
    expect(next.result).toEqual(result);
    expect(next.screen).toBe('success');
  });
});
