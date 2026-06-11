# Example: Exchange integration

A runnable exchange/broker that adopts [`@trustline-onboarder/sdk`](../../packages/sdk) to onboard
a withdrawing user whose account has no trustline — the recurring blocker that makes native
Stellar withdrawals fail.

It demonstrates the **sender** side end-to-end on testnet, with both options an exchange has:

- **A) Redirect** — the exchange does not hold the user's key, so it hands the user to the hosted
  activation page. `startOnboarding({ prefer: 'redirect' })` returns the deep link (asset, amount,
  destination, branding, return URL).
- **B) Send now, claim later** — the exchange creates a claimable balance to the user with
  `buildSend`, signs it with its distributor key, and submits. The user later claims it with a
  sponsored trustline (the recipient/SDK flow). The full round-trip runs in the script.

The example funds fresh testnet keypairs via Friendbot (issuer, distributor, sponsor, user) and
mints a demo asset, so no secrets are needed.

```bash
pnpm --filter @trustline-onboarder/example-exchange start
```

The sponsor here is a local keypair; in production back it with a KMS signer via
[`@trustline-onboarder/sdk/server`](../../packages/sdk/src/server.ts). See the
[integration guide](../../docs/integration-guide.md).
