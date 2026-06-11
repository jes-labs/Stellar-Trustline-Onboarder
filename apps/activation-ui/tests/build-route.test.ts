import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST } from '../app/api/activation/build/route';

const SECRET = 'test-jwt-secret';

function buildRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/activation/build', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      config: { assetCode: 'EURC', amount: '1', platform: 'X' },
      address: 'GUSER',
    }),
  });
}

async function token(sub: string): Promise<string> {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(SECRET));
}

describe('POST /api/activation/build auth guard', () => {
  beforeAll(() => {
    // Enable auth, but leave the chain unconfigured so the route simulates the build.
    process.env.WEB_AUTH_JWT_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.WEB_AUTH_JWT_SECRET = undefined;
  });

  it('rejects a request with no session token', async () => {
    const res = await POST(buildRequest());
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const res = await POST(buildRequest({ authorization: 'Bearer not-a-jwt' }));
    expect(res.status).toBe(401);
  });

  it('accepts a request with a valid session token', async () => {
    const res = await POST(buildRequest({ authorization: `Bearer ${await token('GUSER')}` }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { simulated?: boolean };
    expect(body.simulated).toBe(true);
  });
});
