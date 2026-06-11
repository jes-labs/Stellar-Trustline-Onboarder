'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { type ActivationBackend, ActivationError, type ActivationResult } from './backend';
import { DEMO_ADDRESS } from './config';
import type { StatusAction } from './statusScreens';
import type { ActivationConfig, Screen, WalletId } from './types';

interface State {
  screen: Screen;
  walletId: WalletId | null;
  address: string;
  result: ActivationResult | null;
  connecting: boolean;
}

type Action =
  | { type: 'getStarted' }
  | { type: 'back' }
  | { type: 'goto'; screen: Screen }
  | { type: 'selectWallet'; walletId: WalletId }
  | { type: 'connected'; address: string }
  | { type: 'edge'; screen: Screen }
  | { type: 'approve' }
  | { type: 'submitting' }
  | { type: 'succeeded'; result: ActivationResult };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'getStarted':
      return { ...state, screen: 'connect' };
    case 'back':
      return { ...state, screen: state.screen === 'review' ? 'connect' : 'welcome' };
    case 'goto':
      return { ...state, screen: action.screen };
    case 'selectWallet':
      return { ...state, walletId: action.walletId, connecting: true };
    case 'connected':
      return { ...state, address: action.address, connecting: false, screen: 'review' };
    case 'edge':
      return { ...state, connecting: false, screen: action.screen };
    case 'approve':
      return { ...state, screen: 'approve' };
    case 'submitting':
      return { ...state, screen: 'processing' };
    case 'succeeded':
      return { ...state, result: action.result, screen: 'success' };
    default:
      return state;
  }
}

export interface ActivationActions {
  getStarted: () => void;
  back: () => void;
  selectWallet: (id: WalletId) => void;
  noWallet: () => void;
  activate: () => void;
  runStatusAction: (action: StatusAction) => void;
}

export interface UseActivation {
  state: State;
  actions: ActivationActions;
}

function navigate(url: string): void {
  window.location.href = url;
}

/**
 * Owns the flow: which screen is showing, the connected wallet, and the activation run. Pure
 * transitions live in the reducer; the async work (connect, build, sign, submit) runs here and
 * dispatches back. The returned `actions` are stable, so screens never re-render from new
 * handler identities.
 */
export function useActivation(config: ActivationConfig, backend: ActivationBackend): UseActivation {
  const [state, dispatch] = useReducer(reducer, {
    screen: 'welcome',
    walletId: null,
    address: config.destination ?? DEMO_ADDRESS,
    result: null,
    connecting: false,
  });

  // A ref mirror of state so the stable callbacks can read the latest values without being
  // re-created on every transition.
  const stateRef = useRef(state);
  stateRef.current = state;

  const runRef = useRef<AbortController | null>(null);

  useEffect(() => () => runRef.current?.abort(), []);

  const runActivate = useCallback(() => {
    runRef.current?.abort();
    const controller = new AbortController();
    runRef.current = controller;
    dispatch({ type: 'approve' });

    backend
      .activate({
        config,
        walletId: stateRef.current.walletId ?? 'freighter',
        address: stateRef.current.address,
        onSubmitting: () => dispatch({ type: 'submitting' }),
        signal: controller.signal,
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'succeeded', result });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const screen = err instanceof ActivationError ? err.code : 'failed';
        dispatch({ type: 'edge', screen });
      });
  }, [backend, config]);

  const selectWallet = useCallback(
    (id: WalletId) => {
      dispatch({ type: 'selectWallet', walletId: id });
      backend
        .connect(id)
        .then(({ address }) => dispatch({ type: 'connected', address }))
        .catch((err: unknown) => {
          const screen = err instanceof ActivationError ? err.code : 'failed';
          dispatch({ type: 'edge', screen });
        });
    },
    [backend],
  );

  const runStatusAction = useCallback(
    (action: StatusAction) => {
      switch (action) {
        case 'cancel':
          runRef.current?.abort();
          dispatch({ type: 'goto', screen: 'review' });
          return;
        case 'retry':
          runActivate();
          return;
        case 'returnToPlatform':
          if (config.returnUrl) navigate(config.returnUrl);
          else dispatch({ type: 'goto', screen: 'welcome' });
          return;
        case 'viewExplorer':
          if (stateRef.current.result) {
            window.open(stateRef.current.result.explorerUrl, '_blank', 'noopener,noreferrer');
          }
          return;
        case 'continueKyc':
          if (config.returnUrl) navigate(config.returnUrl);
          else runActivate();
          return;
        case 'contactSupport':
          if (config.returnUrl) navigate(config.returnUrl);
          return;
        case 'doLater':
        case 'backToStart':
          dispatch({ type: 'goto', screen: 'welcome' });
          return;
        case 'getWallet':
        case 'haveWallet':
          dispatch({ type: 'goto', screen: 'connect' });
          return;
      }
    },
    [config, runActivate],
  );

  const actions = useMemo<ActivationActions>(
    () => ({
      getStarted: () => dispatch({ type: 'getStarted' }),
      back: () => dispatch({ type: 'back' }),
      selectWallet,
      noWallet: () => dispatch({ type: 'goto', screen: 'no-wallet' }),
      activate: runActivate,
      runStatusAction,
    }),
    [selectWallet, runActivate, runStatusAction],
  );

  return { state, actions };
}
