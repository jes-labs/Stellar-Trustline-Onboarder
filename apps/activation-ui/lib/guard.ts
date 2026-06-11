import 'server-only';
import { NextResponse } from 'next/server';

/**
 * A minimal gate for the sponsor-spending API routes. The sponsor pays real trustline reserves,
 * so an unauthenticated `build`/`submit` endpoint is a funding/signing oracle: left open, anyone
 * could spam it to drain the sponsor's XLM. This enforces an origin allow-list and a per-IP rate
 * limit.
 *
 * The rate-limit store is in-memory and process-local — fine for a single instance, but a
 * multi-instance deployment must swap it for a shared store (Redis/Upstash) and should add
 * per-destination caps and a captcha/proof-of-work on top. See docs/production-checklist.md.
 */

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 30);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  return xff ? (xff.split(',')[0]?.trim() ?? 'unknown') : 'unknown';
}

function originAllowed(req: Request): boolean {
  // No allow-list configured → permissive (development). Configure ALLOWED_ORIGINS in production.
  if (ALLOWED_ORIGINS.length === 0) return true;
  const origin = req.headers.get('origin');
  return origin !== null && ALLOWED_ORIGINS.includes(origin);
}

function rateLimited(ip: string, limit: number): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 10_000) for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

/** Reject disallowed origins and over-limit callers; return null to proceed. */
export function guard(req: Request, limit: number = DEFAULT_LIMIT): NextResponse | null {
  if (!originAllowed(req)) {
    return NextResponse.json({ code: 'failed', message: 'origin not allowed' }, { status: 403 });
  }
  if (rateLimited(clientIp(req), limit)) {
    return NextResponse.json({ code: 'failed', message: 'rate limit exceeded' }, { status: 429 });
  }
  return null;
}
