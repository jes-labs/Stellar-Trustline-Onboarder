import 'server-only';
import { Keypair } from '@stellar/stellar-sdk';
import { PUBLIC, TESTNET } from '@trustline-onboarder/core';

/**
 * Server-only Stellar configuration. The sponsor secret, Horizon URL, and approval-server URL
 * live here and never reach the client bundle (`server-only` makes a client import a build error).
 *
 * `STELLAR_NETWORK` (`testnet` | `public`) selects the network; `HORIZON_URL` can override the
 * endpoint within it. Defaults to testnet so a fresh checkout runs with no configuration.
 */

const NETWORK = process.env.STELLAR_NETWORK === 'public' ? PUBLIC : TESTNET;

/**
 * Live mode touches the chain for real (build, sponsor-sign, submit). Left off — the default —
 * the build route returns a simulated response so the app runs with no sponsor secret and no
 * wallet. A live deployment sets `ACTIVATION_MODE=live` here and `NEXT_PUBLIC_ACTIVATION_MODE=live`
 * on the client.
 */
export const LIVE = process.env.ACTIVATION_MODE === 'live';

/** True on testnet, where we may Friendbot-fund a recipient account that does not exist yet. */
export const IS_TESTNET = NETWORK === TESTNET;

export const HORIZON_URL = process.env.HORIZON_URL ?? NETWORK.horizonUrl;
export const NETWORK_PASSPHRASE = NETWORK.networkPassphrase;
export const APPROVAL_SERVER_URL = process.env.APPROVAL_SERVER_URL;

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
