/**
 * @trustline-onboarder/discovery — stellar.toml + well-known descriptor (stub).
 *
 * Full implementation lands in Phase 3. The intended surface:
 *   - toml.ts:      generate/parse the [[CURRENCIES]] + onboarding fields in stellar.toml,
 *                   including the approval server URL and supported mechanisms.
 *   - wellknown.ts: the onboarding service descriptor advertising endpoint + capabilities,
 *                   mirroring how SEP-24 advertises a transfer server.
 */

export const DISCOVERY_VERSION = '0.0.0';
