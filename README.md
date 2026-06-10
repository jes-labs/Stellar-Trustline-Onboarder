# Trustline Onboarder

An ecosystem **standard** plus an open-source **reference implementation** that lets exchanges,
brokers, and wallets move users into Stellar **classic assets** without forcing a manual
trustline step — including the authorization layer a MiCA-regulated issuer needs.

Everything is built on primitives that are **live on Stellar mainnet today**. Nothing on the
critical path depends on a draft CAP.

> Approach: **implementation first, then distill the SEP from the working code.**

## The three mechanisms

| | Mechanism | When | Status here |
| - | --------- | ---- | ----------- |
| **C** | Claimable balance — *send now, activate later* | Universal default | ✅ implemented (Phase 0) |
| **A** | Authorize the trustline — *hold before receiving* | Regulated assets | 🟡 builders + approval server (Phase 1) |
| **B** | Temporary intermediate account | Specific custodial setups | ⬜ stub only |

All reserves are **sponsored**, so the recipient never needs XLM.

## Monorepo layout

```
packages/
  core        # @trustline-onboarder/core      — types + transaction builders (A, B, C) + sponsorship + tx
  sdk         # @trustline-onboarder/sdk        — adopter-facing SDK (detect / onboard / verify)   [stub]
  discovery   # @trustline-onboarder/discovery  — stellar.toml generation/parsing                  [stub]
  signer      # @trustline-onboarder/signer     — issuer signing adapters (local key, KMS)
apps/
  approval-server  # Fastify SEP-8-style /tx-approve, compliance check, issuer authorization
  activation-ui    # Next.js "Welcome to Stellar" landing page                                     [stub]
  demo             # tsx end-to-end testnet runner exercising the mechanisms
examples/          # wallet-integration, exchange-integration                                      [placeholders]
```

## Quick start

```bash
pnpm install
pnpm build          # build the libraries
pnpm typecheck
pnpm lint           # Biome
pnpm test           # Vitest unit tests

pnpm demo           # unregulated Mechanism C, end-to-end on testnet (zero-touch receive)
# Phase 1 (needs the approval server running):
pnpm --filter @trustline-onboarder/approval-server dev
pnpm demo:regulated # AUTH_REQUIRED asset onboarded through the approval server
```

The demo funds fresh keypairs via **Friendbot**, so no secrets are required for testnet.

## Status

Phase 0 (Mechanism C spine) is complete and is the artifact for the SCF submission and partner
demos. Phase 1 (approval server + regulated path) is in progress. See
[`PRD_Trustline_Onboarder_Implementation.md`](PRD_Trustline_Onboarder_Implementation.md) for the
full engineering plan.

## License

Apache-2.0
