import { Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { bearerToken, WebAuthService } from './web-auth';

const serverKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
const clientKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));

const config = {
  serverSecret: serverKp.secret(),
  network: Networks.TESTNET,
  homeDomain: 'localhost',
  webAuthDomain: 'localhost',
  jwtSecret: 'test-secret',
};

describe('WebAuthService', () => {
  it('round-trips challenge then sign then token then verify', async () => {
    const svc = new WebAuthService(config);
    const challenge = svc.buildChallenge(clientKp.publicKey());
    const signed = new Transaction(challenge, Networks.TESTNET);
    signed.sign(clientKp);

    const token = await svc.verifyChallenge(signed.toXDR());
    expect(await svc.verifyToken(token)).toBe(clientKp.publicKey());
  });

  it('rejects a challenge the client did not sign', async () => {
    const svc = new WebAuthService(config);
    const challenge = svc.buildChallenge(clientKp.publicKey());
    await expect(svc.verifyChallenge(challenge)).rejects.toThrow();
  });

  it('returns null for a garbage token', async () => {
    const svc = new WebAuthService(config);
    expect(await svc.verifyToken('not-a-jwt')).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const issuerSvc = new WebAuthService(config);
    const token = await issuerSvc.issueToken(clientKp.publicKey());
    const otherSvc = new WebAuthService({ ...config, jwtSecret: 'different-secret' });
    expect(await otherSvc.verifyToken(token)).toBeNull();
  });

  it('parses bearer tokens', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('abc')).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });
});
