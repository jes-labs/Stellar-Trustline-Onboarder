import { Keypair, Networks } from '@stellar/stellar-sdk';

/** Runtime configuration for the approval server. */
export interface ServerConfig {
  /** Issuer secret seed (Sxxx). In production this lives behind an HSM/signing service, never in env. */
  issuerSecret: string;
  /** Network passphrase the server signs against. */
  network: string;
  /** Horizon endpoint used for admin freeze/clawback submission. */
  horizonUrl: string;
  /** The asset code this issuer operates (advertised in discovery). */
  assetCode: string;
  /**
   * Bearer token guarding the admin endpoints (`/admin/freeze`, `/admin/clawback`, `/admin/kyc`).
   * These sign issuer operations or change KYC state, so they must be authenticated. When unset
   * the admin endpoints are disabled.
   */
  adminToken?: string;
  /** Home domain used in SEP-10 challenges. */
  homeDomain: string;
  /** Web-auth domain used in SEP-10 challenges. */
  webAuthDomain: string;
  /** Symmetric secret for SEP-10 session tokens. Share with any other verifier (e.g. the UI). */
  jwtSecret: string;
  /** Postgres connection string. When unset, an in-memory store is used (development only). */
  databaseUrl?: string;
  port: number;
  host: string;
}

/**
 * Build config from the environment, falling back to dev-friendly defaults. If no `ISSUER_SECRET`
 * is provided, a random testnet issuer is generated (and must be funded and flagged separately),
 * which is convenient for local experimentation. A random `jwtSecret` is generated when unset, so
 * tokens are valid only for the life of the process unless `WEB_AUTH_JWT_SECRET` is set.
 */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    issuerSecret: env.ISSUER_SECRET ?? Keypair.random().secret(),
    network: env.NETWORK_PASSPHRASE ?? Networks.TESTNET,
    horizonUrl: env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    assetCode: env.ASSET_CODE ?? 'EURC',
    adminToken: env.ADMIN_TOKEN,
    homeDomain: env.HOME_DOMAIN ?? 'localhost',
    webAuthDomain: env.WEB_AUTH_DOMAIN ?? env.HOME_DOMAIN ?? 'localhost',
    jwtSecret: env.WEB_AUTH_JWT_SECRET ?? Keypair.random().secret(),
    databaseUrl: env.DATABASE_URL,
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '127.0.0.1',
  };
}
