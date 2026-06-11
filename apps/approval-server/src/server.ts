/**
 * Standalone entrypoint for the approval server.
 *
 *   pnpm --filter @trustline-onboarder/approval-server dev
 *
 * Configure via env: ISSUER_SECRET, NETWORK_PASSPHRASE, HORIZON_URL, ASSET_CODE, ADMIN_TOKEN,
 * HOME_DOMAIN, WEB_AUTH_DOMAIN, WEB_AUTH_JWT_SECRET, DATABASE_URL, PORT, HOST. If ISSUER_SECRET is
 * omitted a random testnet issuer is generated (fund and flag it separately). With DATABASE_URL
 * set the audit trail and KYC state are stored in Postgres; otherwise an in-memory store is used.
 */

import { Keypair } from '@stellar/stellar-sdk';
// pg is CommonJS; import the default and destructure so this works under the ESM entrypoint.
import pg from 'pg';
import { type BuildServerDeps, buildServer } from './app';
import { configFromEnv } from './config';
import { PostgresStore } from './store.postgres';

async function main(): Promise<void> {
  const config = configFromEnv();
  // For local development, mint an admin token if one was not provided, so the admin endpoints
  // are usable. In production ADMIN_TOKEN must be set explicitly.
  if (!config.adminToken) {
    config.adminToken = Keypair.random().secret();
    console.log('No ADMIN_TOKEN set: generated a dev token (admin endpoints require it):');
    console.log(`  ADMIN_TOKEN=${config.adminToken}`);
  }

  const deps: BuildServerDeps = {};
  if (config.databaseUrl) {
    const store = new PostgresStore(new pg.Pool({ connectionString: config.databaseUrl }));
    await store.init();
    deps.store = store;
    console.log('store:   Postgres');
  } else {
    console.log('store:   in-memory (development only; state is lost on restart)');
  }

  const { app, issuer } = buildServer(config, deps);
  await app.listen({ port: config.port, host: config.host });
  console.log(`approval-server listening on http://${config.host}:${config.port}`);
  console.log(`issuer:  ${issuer}`);
  console.log(`asset:   ${config.assetCode}`);
  console.log(`network: ${config.network}`);
}

main().catch((err) => {
  console.error('approval-server failed to start:', err);
  process.exit(1);
});
