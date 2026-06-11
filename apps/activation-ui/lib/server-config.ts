/**
 * Server-side chain configuration, read from the environment. Import only from route handlers
 * and server modules, never from a component.
 *
 * When these are unset the API routes fall back to a simulated chain, so the app runs locally
 * with no secrets. A live deployment sets all three of NETWORK_PASSPHRASE, HORIZON_URL, and
 * SPONSOR_SECRET (and APPROVAL_SERVER_URL for a regulated asset).
 */

export interface ServerChainConfig {
  network: string;
  horizonUrl: string;
  /** Secret seed of the account that sponsors trustline reserves. */
  sponsorSecret: string;
  /** Issuer SEP-8 approval server. Its presence marks the asset as regulated. */
  approvalServerUrl?: string;
  explorerTxBase: string;
}

const DEFAULT_EXPLORER = 'https://stellar.expert/explorer/testnet/tx/';

/** Whether the live chain path is configured. When false, the routes simulate. */
export function isLiveConfigured(): boolean {
  return Boolean(
    process.env.SPONSOR_SECRET && process.env.HORIZON_URL && process.env.NETWORK_PASSPHRASE,
  );
}

export function serverChainConfig(): ServerChainConfig {
  const { NETWORK_PASSPHRASE, HORIZON_URL, SPONSOR_SECRET, APPROVAL_SERVER_URL, EXPLORER_TX_BASE } =
    process.env;
  if (!NETWORK_PASSPHRASE || !HORIZON_URL || !SPONSOR_SECRET) {
    throw new Error(
      'activation chain is not configured: set NETWORK_PASSPHRASE, HORIZON_URL, and SPONSOR_SECRET',
    );
  }
  return {
    network: NETWORK_PASSPHRASE,
    horizonUrl: HORIZON_URL,
    sponsorSecret: SPONSOR_SECRET,
    approvalServerUrl: APPROVAL_SERVER_URL,
    explorerTxBase: EXPLORER_TX_BASE ?? DEFAULT_EXPLORER,
  };
}
