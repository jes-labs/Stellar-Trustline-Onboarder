/**
 * Standalone entrypoint for the approval server.
 *
 *   pnpm --filter @trustline-onboarder/approval-server dev
 *
 * Configure via env: ISSUER_SECRET, NETWORK_PASSPHRASE, HORIZON_URL, ASSET_CODE, PORT, HOST.
 * If ISSUER_SECRET is omitted a random testnet issuer is generated (fund + flag it separately).
 */

import { buildServer } from './app';
import { configFromEnv } from './config';

async function main(): Promise<void> {
  const config = configFromEnv();
  const { app, issuer } = buildServer(config);
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
