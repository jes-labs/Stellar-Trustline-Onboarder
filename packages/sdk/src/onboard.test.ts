import { Account, Keypair, Networks } from '@stellar/stellar-sdk';
import type { AssetRef, NetworkConfig } from '@trustline-onboarder/core';
import { describe, expect, it } from 'vitest';
import { type OnboardingRequest, planOnboarding } from './onboard';

const network: NetworkConfig = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
};

const issuer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey();
const recipient = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2)).publicKey();
const sponsor = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey();
const asset: AssetRef = { code: 'EURC', issuer };

const source = () => new Account(recipient, '0');
const types = (built: { operations: { type: string }[] }) => built.operations.map((o) => o.type);

function request(over: Partial<OnboardingRequest>): OnboardingRequest {
  return {
    network,
    mechanism: 'authorize',
    profile: 'unregulated',
    asset,
    recipient,
    sponsor,
    ...over,
  };
}

describe('planOnboarding', () => {
  it('routes an unregulated claim to the sponsored claim sequence', () => {
    const built = planOnboarding(
      request({ mechanism: 'claimable', profile: 'unregulated', balanceId: '0'.repeat(72) }),
      source(),
    );
    expect(types(built)).toEqual([
      'beginSponsoringFutureReserves',
      'changeTrust',
      'endSponsoringFutureReserves',
      'claimClaimableBalance',
    ]);
    expect(built.issuerAuthOpIndex).toBeUndefined();
  });

  it('routes a regulated claim through the issuer authorization', () => {
    const built = planOnboarding(
      request({ mechanism: 'claimable', profile: 'regulated', balanceId: '0'.repeat(72) }),
      source(),
    );
    expect(types(built)).toContain('setTrustLineFlags');
    expect(built.issuerAuthOpIndex).toBe(3);
    expect(built.requiredSigners).toContain(issuer);
  });

  it('routes authorize to the sponsored trustline sequence', () => {
    const built = planOnboarding(
      request({ mechanism: 'authorize', profile: 'unregulated' }),
      source(),
    );
    expect(types(built)).toEqual([
      'beginSponsoringFutureReserves',
      'changeTrust',
      'endSponsoringFutureReserves',
    ]);
  });

  it('requires a balanceId for a claim', () => {
    expect(() => planOnboarding(request({ mechanism: 'claimable' }), source())).toThrow(
      /balanceId/,
    );
  });

  it('rejects the unimplemented intermediate mechanism', () => {
    expect(() => planOnboarding(request({ mechanism: 'intermediate' }), source())).toThrow(
      /not implemented/,
    );
  });
});
