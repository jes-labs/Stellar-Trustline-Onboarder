import { Account, Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import {
  type ApprovalResult,
  buildClaimRegulated,
  buildClaimUnregulated,
} from '@trustline-onboarder/core';
import { parseStellarToml } from '@trustline-onboarder/discovery';
import { beforeEach, describe, expect, it } from 'vitest';
import { type BuiltServer, buildServer } from './app';
import type { ServerConfig } from './config';

const NETWORK = Networks.TESTNET;
const issuerKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 9));
const recipientKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 8));
const sponsorKp = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));

const issuer = issuerKp.publicKey();
const recipient = recipientKp.publicKey();
const sponsor = sponsorKp.publicKey();
const assetRef = { code: 'EURC', issuer };
const account = (pubkey: string) => new Account(pubkey, '10');

function makeConfig(over: Partial<ServerConfig> = {}): ServerConfig {
  return {
    issuerSecret: issuerKp.secret(),
    network: NETWORK,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    assetCode: 'EURC',
    adminToken: 'test-token',
    homeDomain: 'localhost',
    webAuthDomain: 'localhost',
    jwtSecret: 'test-jwt-secret',
    port: 0,
    host: '127.0.0.1',
    ...over,
  };
}

const regulatedClaimXdr = () =>
  buildClaimRegulated(
    { asset: assetRef, recipient, sponsor, balanceId: '0'.repeat(72) },
    account(recipient),
    NETWORK,
  ).xdr;

let server: BuiltServer;
beforeEach(() => {
  server = buildServer(makeConfig());
});

// A SEP-10 session token for an account (minted directly; the full challenge flow is covered
// in web-auth.test.ts and in the SEP-10 describe below).
const tokenFor = (acct: string) => server.webAuth.issueToken(acct);
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('GET /info', () => {
  it('advertises the issuer and supported mechanisms', async () => {
    const res = await server.app.inject({ method: 'GET', url: '/info' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.issuer).toBe(issuer);
    expect(body.mechanisms).toEqual(['claimable', 'authorize']);
  });
});

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await server.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /.well-known/stellar.toml', () => {
  it('serves a parseable toml advertising the regulated asset and onboarding service', async () => {
    const res = await server.app.inject({ method: 'GET', url: '/.well-known/stellar.toml' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');

    const parsed = parseStellarToml(res.body);
    expect(parsed.onboarding?.server).toBe('/tx-approve');
    expect(parsed.onboarding?.mechanisms).toEqual(['claimable', 'authorize']);
    expect(parsed.currencies[0]).toMatchObject({
      code: 'EURC',
      issuer,
      regulated: true,
      approvalServer: '/tx-approve',
    });
  });
});

describe('POST /tx-approve', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/tx-approve',
      payload: { tx: regulatedClaimXdr() },
    });
    expect(res.statusCode).toBe(401);
  });

  it('signs a regulated claim for a KYC-approved holder (status="revised")', async () => {
    await server.store.setCustomerStatus(recipient, 'approved');
    const res = await server.app.inject({
      method: 'POST',
      url: '/tx-approve',
      headers: bearer(await tokenFor(recipient)),
      payload: { tx: regulatedClaimXdr() },
    });
    const body = res.json<ApprovalResult>();
    expect(body.status).toBe('revised');
    expect(body.tx).toBeTruthy();
    expect(await server.store.auditLog()).toHaveLength(1);
    expect(await server.store.listAuthorizations()).toHaveLength(1);
  });

  it('is idempotent: re-submitting the same tx does not sign or audit twice', async () => {
    await server.store.setCustomerStatus(recipient, 'approved');
    const headers = bearer(await tokenFor(recipient));
    const tx = regulatedClaimXdr();
    const first = (
      await server.app.inject({ method: 'POST', url: '/tx-approve', headers, payload: { tx } })
    ).json<ApprovalResult>();
    const second = (
      await server.app.inject({ method: 'POST', url: '/tx-approve', headers, payload: { tx } })
    ).json<ApprovalResult>();
    expect(second).toEqual(first);
    expect(await server.store.auditLog()).toHaveLength(1);
    expect(server.approvals.size).toBe(1);
  });

  it('returns action_required when the holder has no KYC approval (fail-closed)', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/tx-approve',
      headers: bearer(await tokenFor(recipient)),
      payload: { tx: regulatedClaimXdr() },
    });
    expect(res.json<ApprovalResult>().status).toBe('action_required');
    expect(await server.store.auditLog()).toHaveLength(0);
  });

  it('rejects when the holder KYC is denied', async () => {
    await server.store.setCustomerStatus(recipient, 'denied');
    const res = await server.app.inject({
      method: 'POST',
      url: '/tx-approve',
      headers: bearer(await tokenFor(recipient)),
      payload: { tx: regulatedClaimXdr() },
    });
    const body = res.json<ApprovalResult>();
    expect(body.status).toBe('rejected');
    expect(body.error).toBe('kyc_denied');
  });

  it('approves an unregulated claim as-is (status="success")', async () => {
    const tx = buildClaimUnregulated(
      { asset: assetRef, recipient, sponsor, balanceId: '0'.repeat(72) },
      account(recipient),
      NETWORK,
    ).xdr;
    const body = (
      await server.app.inject({
        method: 'POST',
        url: '/tx-approve',
        headers: bearer(await tokenFor(recipient)),
        payload: { tx },
      })
    ).json<ApprovalResult>();
    expect(body.status).toBe('success');
  });

  it('rejects invalid XDR', async () => {
    const body = (
      await server.app.inject({
        method: 'POST',
        url: '/tx-approve',
        headers: bearer(await tokenFor(recipient)),
        payload: { tx: 'not-xdr' },
      })
    ).json<ApprovalResult>();
    expect(body.status).toBe('rejected');
    expect(body.error).toBe('invalid_xdr');
  });

  it('400s when tx is missing', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/tx-approve',
      headers: bearer(await tokenFor(recipient)),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('SEP-10 auth', () => {
  it('400s a challenge request without an account', async () => {
    const res = await server.app.inject({ method: 'GET', url: '/auth' });
    expect(res.statusCode).toBe(400);
  });

  it('issues a token through challenge then verify, accepted on /tx-approve', async () => {
    const challenge = (
      await server.app.inject({ method: 'GET', url: `/auth?account=${recipient}` })
    ).json<{ transaction: string }>();
    const signed = new Transaction(challenge.transaction, NETWORK);
    signed.sign(recipientKp);
    const verified = (
      await server.app.inject({
        method: 'POST',
        url: '/auth',
        payload: { transaction: signed.toXDR() },
      })
    ).json<{ token: string }>();
    expect(verified.token).toBeTruthy();

    await server.store.setCustomerStatus(recipient, 'approved');
    const approve = await server.app.inject({
      method: 'POST',
      url: '/tx-approve',
      headers: bearer(verified.token),
      payload: { tx: regulatedClaimXdr() },
    });
    expect(approve.json<ApprovalResult>().status).toBe('revised');
  });
});

describe('admin authentication', () => {
  it('401s without a valid bearer token', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/admin/freeze',
      payload: { trustor: recipient },
    });
    expect(res.statusCode).toBe(401);
  });

  it('503s when admin endpoints are disabled (no token configured)', async () => {
    const disabled = buildServer(makeConfig({ adminToken: undefined }));
    const res = await disabled.app.inject({
      method: 'POST',
      url: '/admin/clawback',
      headers: bearer('test-token'),
      payload: { from: recipient, amount: '1' },
    });
    expect(res.statusCode).toBe(503);
  });

  it('sets KYC status through /admin/kyc with a valid token', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/admin/kyc',
      headers: bearer('test-token'),
      payload: { account: recipient, status: 'approved' },
    });
    expect(res.statusCode).toBe(200);
    expect(await server.store.getCustomerStatus(recipient)).toBe('approved');
  });
});
