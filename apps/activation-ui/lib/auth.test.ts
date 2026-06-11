import { SignJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import { authEnabled, bearer, verifySession } from './auth';

const SECRET = 'unit-secret';

async function mint(sub: string, secret = SECRET): Promise<string> {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));
}

describe('bearer', () => {
  it('parses a bearer header', () => {
    expect(bearer('Bearer abc.def')).toBe('abc.def');
    expect(bearer('abc')).toBeUndefined();
    expect(bearer(null)).toBeUndefined();
  });
});

describe('authEnabled and verifySession', () => {
  afterEach(() => {
    delete process.env.WEB_AUTH_JWT_SECRET;
  });

  it('reports auth disabled when no secret is set', () => {
    delete process.env.WEB_AUTH_JWT_SECRET;
    expect(authEnabled()).toBe(false);
  });

  it('verifies a token signed with the configured secret', async () => {
    process.env.WEB_AUTH_JWT_SECRET = SECRET;
    expect(authEnabled()).toBe(true);
    expect(await verifySession(await mint('GUSER'))).toBe('GUSER');
  });

  it('rejects a token signed with a different secret', async () => {
    process.env.WEB_AUTH_JWT_SECRET = SECRET;
    expect(await verifySession(await mint('GUSER', 'other-secret'))).toBeNull();
  });

  it('rejects missing or malformed tokens', async () => {
    process.env.WEB_AUTH_JWT_SECRET = SECRET;
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession('garbage')).toBeNull();
  });
});
