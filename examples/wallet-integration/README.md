# Example: Wallet integration

A runnable, self-custody wallet that adopts [`@trustline-onboarder/sdk`](../../packages/sdk) to
onboard a user into a Stellar asset — no XLM for the reserve, no manual "create a trustline"
prompt.

It demonstrates the **recipient** flow end-to-end on testnet:

1. `detect` — does the user already hold the asset? (Gate onboarding on this.)
2. `activateWithWallet` (from `@trustline-onboarder/sdk/client`) — build a sponsored trustline,
   sign it with the user's key **in-wallet**, and submit. The wallet supplies only its own
   signing function; the SDK never sees the key.
3. `verifyActivation` — confirm the trustline before treating the user as onboarded.

It also prints the **redirect alternative**: a wallet that prefers not to build the transaction
can hand the user to the hosted activation page with `startOnboarding({ prefer: 'redirect' })`.

The example funds fresh testnet keypairs via Friendbot (including its own bring-your-own
sponsor), so no secrets are needed.

```bash
pnpm --filter @trustline-onboarder/example-wallet start
```

The sponsor here is a local keypair for simplicity. In production, back it with a KMS signer via
[`@trustline-onboarder/sdk/server`](../../packages/sdk/src/server.ts) (`sponsorFromSigner`) so the
key never lives in process. See the [integration guide](../../docs/integration-guide.md).
