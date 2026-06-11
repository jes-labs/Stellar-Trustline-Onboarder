import type { AssetProfile, Mechanism } from '@trustline-onboarder/core';
import { parse, stringify } from 'smol-toml';
import type { OnboardingCurrency, OnboardingService, StellarToml } from './types';

const MECHANISMS: readonly Mechanism[] = ['claimable', 'authorize', 'intermediate'];
const PROFILES: readonly AssetProfile[] = ['regulated', 'unregulated'];

/**
 * Render a {@link StellarToml} as SEP-1 text. Top-level scalar keys are emitted first and the
 * `[[CURRENCIES]]` tables last, which is the order TOML requires.
 */
export function buildStellarToml(doc: StellarToml): string {
  const out: Record<string, unknown> = {};

  if (doc.networkPassphrase) out.NETWORK_PASSPHRASE = doc.networkPassphrase;

  if (doc.onboarding) {
    out.ONBOARDING_SERVER = doc.onboarding.server;
    out.ONBOARDING_MECHANISMS = [...doc.onboarding.mechanisms];
    out.ONBOARDING_PROFILES = [...doc.onboarding.profiles];
  }

  if (doc.currencies.length > 0) {
    out.CURRENCIES = doc.currencies.map(currencyToTable);
  }

  return stringify(out);
}

function currencyToTable(currency: OnboardingCurrency): Record<string, unknown> {
  const row: Record<string, unknown> = {
    code: currency.code,
    issuer: currency.issuer,
    regulated: currency.regulated,
  };
  if (currency.approvalServer) row.approval_server = currency.approvalServer;
  if (currency.approvalCriteria) row.approval_criteria = currency.approvalCriteria;
  return row;
}

/**
 * Parse a stellar.toml and extract the onboarding-relevant fields. Tolerant by design: unknown
 * mechanisms or profiles are dropped and malformed currency entries are skipped, so a real-world
 * toml with extra sections parses cleanly.
 */
export function parseStellarToml(text: string): StellarToml {
  const raw = parse(text) as Record<string, unknown>;
  return {
    networkPassphrase: asString(raw.NETWORK_PASSPHRASE),
    onboarding: parseOnboarding(raw),
    currencies: parseCurrencies(raw.CURRENCIES),
  };
}

function parseOnboarding(raw: Record<string, unknown>): OnboardingService | undefined {
  const server = asString(raw.ONBOARDING_SERVER);
  if (!server) return undefined;
  return {
    server,
    mechanisms: filterKnown(raw.ONBOARDING_MECHANISMS, MECHANISMS),
    profiles: filterKnown(raw.ONBOARDING_PROFILES, PROFILES),
  };
}

function parseCurrencies(value: unknown): OnboardingCurrency[] {
  if (!Array.isArray(value)) return [];
  const currencies: OnboardingCurrency[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as Record<string, unknown>;
    const code = asString(row.code);
    const issuer = asString(row.issuer);
    if (!code || !issuer) continue;
    currencies.push({
      code,
      issuer,
      regulated: row.regulated === true,
      approvalServer: asString(row.approval_server),
      approvalCriteria: asString(row.approval_criteria),
    });
  }
  return currencies;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function filterKnown<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => allowed.includes(item as T));
}
