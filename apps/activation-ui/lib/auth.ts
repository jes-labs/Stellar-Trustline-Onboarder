import { jwtVerify } from 'jose';

/**
 * Verify the SEP-10 session token on a server route. The token is issued by the issuer's approval
 * server; this side only needs the shared secret to verify it. Auth is enforced only when
 * WEB_AUTH_JWT_SECRET is configured, so local development with no secrets still runs.
 */

export function authEnabled(): boolean {
  return Boolean(process.env.WEB_AUTH_JWT_SECRET);
}

export function bearer(header: string | null): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : undefined;
}

/** Returns the authenticated account, or null if the token is missing or invalid. */
export async function verifySession(token: string | undefined): Promise<string | null> {
  const secret = process.env.WEB_AUTH_JWT_SECRET;
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
