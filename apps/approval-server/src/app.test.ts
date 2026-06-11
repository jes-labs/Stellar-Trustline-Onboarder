import { Account, Keypair, Networks } from '@stellar/stellar-sdk';
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

describe('GET /info', () => {
  it('advertises the issuer and supported mechanisms', async () => {
    const res = await server.app.inject({ method: 'GET', url: '/info' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.issuer).toBe(issuer);
    expect(body.mechanisms).toEqual(['claimable', 'authorize']);
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
  it('signs a regulated claim and returns status="revised"', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/tx-approve',
      payload: { tx: regulatedClaimXdr() },
    });
    const body = res.json<ApprovalResult>();
    expect(body.status).toBe('revised');
    expect(body.tx).toBeTruthy();
    expect(server.compliance.audit()).toHaveLength(1);
  });

  it('is idempotent: re-submitting the same tx does not sign or audit twice', async () => {
    const tx = regulatedClaimXdr();
    const first = (
      await server.app.inject({ method: 'POST', url: '/tx-approve', payload: { tx } })
    ).json<ApprovalResult>();
    const second = (
      await server.app.inject({ method: 'POST', url: '/tx-approve', payload: { tx } })
    ).json<ApprovalResult>();
    expect(second).toEqual(first);
    expect(server.compliance.audit()).toHaveLength(1);
    expect(server.approvals.size).toBe(1);
  });

  it('returns action_required when the trustor is not KYC-approved', async () => {
    server.compliance.deny(recipient);
    const res = await server.app.inject({
      method: 'POST',
      url: '/tx-approve',
      payload: { tx: regulatedClaimXdr() },
    });
    const body = res.json<ApprovalResult>();
    expect(body.status).toBe('action_required');
    expect(server.compliance.audit()).toHaveLength(0);
  });

  it('approves an unregulated claim as-is (status="success")', async () => {
    const tx = buildClaimUnregulated(
      { asset: assetRef, recipient, sponsor, balanceId: '0'.repeat(72) },
      account(recipient),
      NETWORK,
    ).xdr;
    const body = (
      await server.app.inject({ method: 'POST', url: '/tx-approve', payload: { tx } })
    ).json<ApprovalResult>();
    expect(body.status).toBe('success');
  });

  it('rejects invalid XDR', async () => {
    const body = (
      await server.app.inject({ method: 'POST', url: '/tx-approve', payload: { tx: 'not-xdr' } })
    ).json<ApprovalResult>();
    expect(body.status).toBe('rejected');
    expect(body.error).toBe('invalid_xdr');
  });

  it('400s when tx is missing', async () => {
    const res = await server.app.inject({ method: 'POST', url: '/tx-approve', payload: {} });
    expect(res.statusCode).toBe(400);
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
      headers: { authorization: 'Bearer test-token' },
      payload: { from: recipient, amount: '1' },
    });
    expect(res.statusCode).toBe(503);
  });
});
