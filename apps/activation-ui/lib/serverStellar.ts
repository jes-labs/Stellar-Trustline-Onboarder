import 'server-only';
import { Keypair } from '@stellar/stellar-sdk';
import { TESTNET } from '@trustline-onboarder/core';

/**
 * Server-only Stellar configuration. The sponsor secret, Horizon URL, and approval-server URL
 * live here and never reach the client bundle (`server-only` makes a client import a build error).
 */

export const HORIZON_URL = process.env.HORIZON_URL ?? TESTNET.horizonUrl;
export const NETWORK_PASSPHRASE = TESTNET.networkPassphrase;
export const APPROVAL_SERVER_URL = process.env.APPROVAL_SERVER_URL;

/** True on testnet, where we may Friendbot-fund a recipient account that does not exist yet. */
export const IS_TESTNET = HORIZON_URL.includes('testnet');

let cachedSponsor: Keypair | null = null;

/** The sponsor keypair that pays trustline reserves. Throws when `SPONSOR_SECRET` is unset. */
export function sponsorKeypair(): Keypair {
  if (cachedSponsor) return cachedSponsor;
  const secret = process.env.SPONSOR_SECRET;
  if (!secret) throw new Error('SPONSOR_SECRET is not configured');
  cachedSponsor = Keypair.fromSecret(secret);
  return cachedSponsor;
}

export function sponsorPublicKey(): string {
  return sponsorKeypair().publicKey();
}
