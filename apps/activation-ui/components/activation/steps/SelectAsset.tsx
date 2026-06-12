'use client';

import type { ClaimableAsset } from '@trustline-onboarder/sdk';
import { useEffect, useRef, useState } from 'react';
import { truncateAddress } from '../../../lib/format';
import type { AssetOption, SelectedAsset } from '../../../lib/types';
import { ArrowDownIcon, ChevronRightIcon, SearchIcon } from '../icons';

/** Codes that exist on testnet and give the search something useful to land on out of the gate. */
const SUGGESTIONS = ['USDC', 'EURC', 'SRT'];

interface FetchState {
  query: string;
  loading: boolean;
  assets: AssetOption[];
  error: boolean;
}

/** Strip trailing zeros from a Horizon amount for display ("42.0000000" → "42"). */
function amountLabel(amount: string): string {
  const n = Number(amount);
  return Number.isFinite(n) ? n.toString() : amount;
}

export function SelectAsset({
  address,
  onChoose,
}: {
  address: string;
  onChoose: (asset: SelectedAsset, balanceId?: string) => void;
}) {
  const [claims, setClaims] = useState<ClaimableAsset[]>([]);

  // The connected wallet's pending claimable balances — the assets it can activate-and-claim now.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/activation/claimable?account=${encodeURIComponent(address)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ claimable: ClaimableAsset[] }>) : null))
      .then((body) => body && setClaims(body.claimable))
      .catch(() => {
        /* a claims lookup failure is non-fatal; the search below still works */
      });
    return () => controller.abort();
  }, [address]);

  const [query, setQuery] = useState('');
  const [state, setState] = useState<FetchState>({
    query: '',
    loading: false,
    assets: [],
    error: false,
  });

  // Debounce the lookup so each keystroke does not hit Horizon, and abort a stale request when a
  // newer query supersedes it.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const code = query.trim();
    if (!code) {
      abortRef.current?.abort();
      setState({ query: '', loading: false, assets: [], error: false });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: false }));
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/activation/assets?code=${encodeURIComponent(code)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error('lookup failed');
          return res.json() as Promise<{ assets: AssetOption[] }>;
        })
        .then(({ assets }) => setState({ query: code, loading: false, assets, error: false }))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setState({ query: code, loading: false, assets: [], error: true });
        });
    }, 300);

    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const trimmed = query.trim();
  const showSuggestions = trimmed.length === 0;
  const showEmpty = !showSuggestions && !state.loading && !state.error && state.assets.length === 0;

  return (
    <>
      <h1 className="mb-[6px] font-heading text-[22px] font-bold tracking-[-0.02em]">
        Choose your asset
      </h1>
      <p className="mb-5 text-[14px] leading-[1.5] text-muted">
        Claim a pending balance, or search for any Stellar asset to activate.
      </p>

      {claims.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">
            Waiting for you
          </div>
          <ul className="flex list-none flex-col gap-[9px]">
            {claims.map((c) => {
              const disabled = !c.claimableNow;
              return (
                <li key={c.balanceId}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChoose(
                        { code: c.asset.code, issuer: c.asset.issuer, regulated: false },
                        c.balanceId,
                      )
                    }
                    className="flex w-full items-center gap-[13px] rounded-[14px] border border-border bg-card p-[14px] text-left transition-colors hover:border-indigo hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo disabled:cursor-default disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-card"
                  >
                    <span className="grid h-[40px] w-[40px] flex-none place-items-center rounded-[12px] bg-tint-success text-success">
                      <ArrowDownIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-[6px]">
                        <span className="font-mono text-[15px] font-semibold text-ink">
                          {amountLabel(c.amount)}
                        </span>
                        <span className="font-mono text-[13px] font-semibold text-muted">
                          {c.asset.code}
                        </span>
                      </span>
                      <span className="mt-[1px] block text-[12px] text-muted">
                        {disabled ? 'Not yet claimable' : 'Pending claim · ready now'}
                      </span>
                    </span>
                    {!disabled && (
                      <span className="flex-none text-muted">
                        <ChevronRightIcon />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 mb-1 text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">
            Or activate another asset
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-[10px] rounded-[14px] border border-border bg-surface px-[14px] py-3 focus-within:border-indigo">
        <span className="text-muted">
          <SearchIcon />
        </span>
        <input
          // biome-ignore lint/a11y/noAutofocus: this step exists only to take this one input.
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code, e.g. USDC"
          spellCheck={false}
          autoCapitalize="characters"
          autoComplete="off"
          className="min-w-0 flex-1 border-none bg-transparent font-mono text-[15px] text-ink outline-none placeholder:font-sans placeholder:text-muted"
        />
      </div>

      {showSuggestions && (
        <div className="flex flex-wrap items-center gap-[9px]">
          <span className="text-[12.5px] text-muted">Popular:</span>
          {SUGGESTIONS.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setQuery(code)}
              className="rounded-full border border-border bg-card px-[13px] py-[5px] font-mono text-[12.5px] font-semibold text-ink transition-colors hover:border-indigo hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
            >
              {code}
            </button>
          ))}
        </div>
      )}

      {state.loading && <p className="py-6 text-center text-[13px] text-muted">Searching…</p>}

      {state.error && (
        <p className="py-6 text-center text-[13px] text-error">
          Could not reach the network. Try again.
        </p>
      )}

      {showEmpty && (
        <p className="py-6 text-center text-[13px] text-muted">
          No assets found for “{trimmed.toUpperCase()}”.
        </p>
      )}

      {!state.loading && state.assets.length > 0 && (
        <ul className="flex max-h-[300px] list-none flex-col gap-[9px] overflow-y-auto">
          {state.assets.map((a) => (
            <li key={`${a.code}:${a.issuer}`}>
              <button
                type="button"
                onClick={() => onChoose({ code: a.code, issuer: a.issuer, regulated: a.regulated })}
                className="flex w-full items-center gap-[13px] rounded-[14px] border border-border bg-card p-[14px] text-left transition-colors hover:border-indigo hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
              >
                <span className="grid h-[40px] w-[40px] flex-none place-items-center rounded-[12px] bg-tint-indigo font-mono text-[12px] font-semibold text-indigo">
                  {a.code.slice(0, 4)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[15px] font-semibold text-ink">{a.code}</span>
                    {a.regulated && (
                      <span className="rounded-[6px] bg-tint-warning px-[7px] py-[2px] text-[10.5px] font-semibold text-warning">
                        Needs issuer approval
                      </span>
                    )}
                  </span>
                  <span className="mt-[2px] block truncate text-[12px] text-muted">
                    {a.domain ? `${a.domain} · ` : ''}
                    <span className="font-mono">{truncateAddress(a.issuer)}</span>
                  </span>
                </span>
                <span className="flex-none text-muted">
                  <ChevronRightIcon />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
