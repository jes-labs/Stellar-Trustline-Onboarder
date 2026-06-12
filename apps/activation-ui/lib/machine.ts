'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { type ActivationBackend, ActivationError, type ActivationResult } from './backend';
import { DEMO_ADDRESS } from './config';
import type { StatusAction } from './statusScreens';
import type { ActivationConfig, Screen, SelectedAsset } from './types';

export interface State {
  screen: Screen;
  /** Display name of the connected wallet (from the kit's selected module); empty until connected. */
  walletName: string;
  address: string;
  result: ActivationResult | null;
  connecting: boolean;
  /** A non-fatal connect error (e.g. the user dismissed the modal), shown inline on connect. */
  connectError: string | null;
  /** The asset being activated; null until chosen in the picker. */
  asset: SelectedAsset | null;
  /** A claimable balance id when the chosen asset is a pending claim; null for a plain trustline. */
  balanceId: string | null;
  /** True when the asset came fixed on the URL (exchange-driven), so the picker is skipped. */
  assetLocked: boolean;
}

export type Action =
  | { type: 'getStarted' }
  | { type: 'back' }
  | { type: 'goto'; screen: Screen }
  | { type: 'chooseAsset'; asset: SelectedAsset; balanceId?: string }
  | { type: 'connecting' }
  | { type: 'connected'; address: string; walletName: string }
  | { type: 'connectFailed'; message: string }
  | { type: 'edge'; screen: Screen }
  | { type: 'approve' }
  | { type: 'submitting' }
  | { type: 'succeeded'; result: ActivationResult };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'getStarted':
      // Connect first, so the picker can show the connected wallet's pending claims.
      return { ...state, screen: 'connect' };
    case 'back':
      switch (state.screen) {
        case 'review':
          return { ...state, screen: state.assetLocked ? 'connect' : 'selectAsset' };
        case 'selectAsset':
          return { ...state, screen: 'connect' };
        default:
          return { ...state, screen: 'welcome' };
      }
    case 'goto':
      return { ...state, screen: action.screen };
    case 'chooseAsset':
      return {
        ...state,
        asset: action.asset,
        balanceId: action.balanceId ?? null,
        screen: 'review',
      };
    case 'connecting':
      return { ...state, connecting: true, connectError: null };
    case 'connected':
      // With a URL-fixed asset there is nothing to pick — go straight to review.
      return {
        ...state,
        address: action.address,
        walletName: action.walletName,
        connecting: false,
        screen: state.assetLocked ? 'review' : 'selectAsset',
      };
    case 'connectFailed':
      return { ...state, connecting: false, connectError: action.message };
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
  chooseAsset: (asset: SelectedAsset, balanceId?: string) => void;
  connect: () => void;
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
  // The asset is fixed only when the URL supplies both a code and an issuer; otherwise the user
  // picks it from Horizon. A code without an issuer is ambiguous, so it does not lock the asset.
  const lockedAsset: SelectedAsset | null = config.issuer
    ? { code: config.assetCode, issuer: config.issuer, regulated: false }
    : null;

  const [state, dispatch] = useReducer(reducer, {
    screen: 'welcome',
    walletName: '',
    address: config.destination ?? DEMO_ADDRESS,
    result: null,
    connecting: false,
    connectError: null,
    asset: lockedAsset,
    balanceId: config.balanceId ?? null,
    assetLocked: lockedAsset !== null,
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

    // Fold the picker-chosen claimable balance into the config the backend builds from; the build
    // route reads `config.balanceId` to decide claim-vs-trustline.
    const current = stateRef.current;
    const effectiveConfig =
      current.balanceId && current.balanceId !== config.balanceId
        ? { ...config, balanceId: current.balanceId }
        : config;

    backend
      .activate({
        config: effectiveConfig,
        asset: current.asset,
        address: current.address,
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

  const connect = useCallback(() => {
    dispatch({ type: 'connecting' });
    backend
      .connect()
      .then(({ address, walletName }) => dispatch({ type: 'connected', address, walletName }))
      .catch((err: unknown) => {
        // Connection failures (including a dismissed modal) keep the user on the connect screen
        // with an inline message, rather than throwing them to the generic error screen.
        const message =
          err instanceof ActivationError && err.message !== err.code
            ? err.message
            : 'Could not connect. Please try again.';
        dispatch({ type: 'connectFailed', message });
      });
  }, [backend]);

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
      chooseAsset: (asset: SelectedAsset, balanceId?: string) =>
        dispatch({ type: 'chooseAsset', asset, balanceId }),
      connect,
      activate: runActivate,
      runStatusAction,
    }),
    [connect, runActivate, runStatusAction],
  );

  return { state, actions };
}
