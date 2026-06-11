import type { ApprovalResult } from '@trustline-onboarder/core';

export interface ApprovalCacheOptions {
  /** Maximum entries retained; the oldest are evicted past this. */
  maxEntries?: number;
  /** How long an approval is remembered. */
  ttlMs?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
}

interface Entry {
  result: ApprovalResult;
  expiresAt: number;
}

/**
 * Idempotency and replay protection for `/tx-approve`, keyed by transaction hash (stable across
 * signing). Re-submitting the same transaction returns the cached result rather than re-signing
 * or re-auditing, so one request can never become two issuer authorizations.
 *
 * The cache is bounded in both size and time so a long-running server cannot grow without limit.
 * The TTL is set comfortably longer than a transaction's validity window, so within the life of a
 * transaction its result is always cached; once it has expired on-chain, evicting the entry is
 * harmless because the transaction can no longer be submitted.
 */
export class ApprovalCache {
  private readonly entries = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: ApprovalCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 1000;
    this.ttlMs = options.ttlMs ?? 60 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  get(txHash: string): ApprovalResult | undefined {
    const entry = this.entries.get(txHash);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(txHash);
      return undefined;
    }
    return entry.result;
  }

  remember(txHash: string, result: ApprovalResult): ApprovalResult {
    this.entries.set(txHash, { result, expiresAt: this.now() + this.ttlMs });
    this.evict();
    return result;
  }

  get size(): number {
    return this.entries.size;
  }

  // Drop expired entries, then the oldest-inserted until back within capacity. A Map iterates in
  // insertion order, so the first key is the oldest.
  private evict(): void {
    if (this.entries.size <= this.maxEntries) return;
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
