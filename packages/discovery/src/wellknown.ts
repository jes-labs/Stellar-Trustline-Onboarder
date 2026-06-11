import { parseStellarToml } from './toml';
import type { StellarToml } from './types';

/** The SEP-1 well-known path a stellar.toml is served from. */
export const STELLAR_TOML_PATH = '/.well-known/stellar.toml';

/** The full URL of a home domain's stellar.toml. Accepts a bare domain or a URL. */
export function wellKnownUrl(homeDomain: string): string {
  const host = homeDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${host}${STELLAR_TOML_PATH}`;
}

export interface ResolveOptions {
  /** Override the fetch implementation (for tests or non-browser runtimes). */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Resolve a home domain's stellar.toml and return its onboarding fields. This is the client-side
 * entry point: given an issuer's home domain, a wallet or exchange discovers the onboarding
 * service and the asset's regulated status from the asset alone.
 */
export async function resolveOnboarding(
  homeDomain: string,
  opts: ResolveOptions = {},
): Promise<StellarToml> {
  const doFetch = opts.fetchImpl ?? fetch;
  const url = wellKnownUrl(homeDomain);
  const res = await doFetch(url, { signal: opts.signal });
  if (!res.ok) {
    throw new Error(`failed to fetch stellar.toml from ${url}: ${res.status}`);
  }
  return parseStellarToml(await res.text());
}
