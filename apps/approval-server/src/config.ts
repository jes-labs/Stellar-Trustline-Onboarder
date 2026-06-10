import { Keypair, Networks } from '@stellar/stellar-sdk';

/** Runtime configuration for the approval server. */
export interface ServerConfig {
  /** Issuer secret seed (Sxxx). In production this lives behind a KMS/HSM, never in env. */
  issuerSecret: string;
  /** Network passphrase the server signs against. */
  network: string;
  /** Horizon endpoint used for admin freeze/clawback submission. */
  horizonUrl: string;
  /** The asset code this issuer operates (advertised in discovery). */
  assetCode: string;
  /**
   * Bearer token guarding the admin endpoints (`/admin/freeze`, `/admin/clawback`). These sign
   * issuer operations, so they must be authenticated. When unset the admin endpoints are disabled.
   */
  adminToken?: string;
  port: number;
  host: string;
}

/**
 * Build config from the environment, falling back to dev-friendly defaults. If no
 * `ISSUER_SECRET` is provided, a random testnet issuer is generated (and must be funded +
 * flagged separately) — convenient for local experimentation.
 */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    issuerSecret: env.ISSUER_SECRET ?? Keypair.random().secret(),
    network: env.NETWORK_PASSPHRASE ?? Networks.TESTNET,
    horizonUrl: env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    assetCode: env.ASSET_CODE ?? 'EURC',
    adminToken: env.ADMIN_TOKEN,
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '127.0.0.1',
  };
}
