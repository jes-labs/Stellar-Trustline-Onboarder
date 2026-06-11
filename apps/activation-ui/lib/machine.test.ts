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
  assetLocked: false,
};

const ASSET: SelectedAsset = { code: 'EURC', issuer: 'GISSUER', regulated: false };

describe('reducer — navigation', () => {
  it('getStarted goes to the picker when no asset is chosen', () => {
    expect(reducer(base, { type: 'getStarted' }).screen).toBe('selectAsset');
  });

  it('getStarted skips the picker when the asset is fixed', () => {
    const locked = { ...base, asset: ASSET, assetLocked: true };
    expect(reducer(locked, { type: 'getStarted' }).screen).toBe('connect');
  });

  it('chooseAsset records the asset and advances to connect', () => {
    const next = reducer({ ...base, screen: 'selectAsset' }, { type: 'chooseAsset', asset: ASSET });
    expect(next.asset).toEqual(ASSET);
    expect(next.screen).toBe('connect');
  });

  it('back from connect returns to the picker, or to welcome when the asset is locked', () => {
    expect(reducer({ ...base, screen: 'connect' }, { type: 'back' }).screen).toBe('selectAsset');
    expect(
      reducer({ ...base, screen: 'connect', assetLocked: true }, { type: 'back' }).screen,
    ).toBe('welcome');
  });

  it('back from review returns to connect; back from selectAsset returns to welcome', () => {
    expect(reducer({ ...base, screen: 'review' }, { type: 'back' }).screen).toBe('connect');
    expect(reducer({ ...base, screen: 'selectAsset' }, { type: 'back' }).screen).toBe('welcome');
  });
});

describe('reducer — connection', () => {
  it('connecting sets the flag and clears any prior error', () => {
    const next = reducer({ ...base, connectError: 'old' }, { type: 'connecting' });
    expect(next.connecting).toBe(true);
    expect(next.connectError).toBeNull();
  });

  it('connected stores the wallet and advances to review', () => {
    const next = reducer(
      { ...base, connecting: true },
      { type: 'connected', address: 'GUSER', walletName: 'Freighter' },
    );
    expect(next).toMatchObject({
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
