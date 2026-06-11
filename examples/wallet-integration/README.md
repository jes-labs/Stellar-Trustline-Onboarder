# Example: Wallet integration

How a self-custody wallet adopts `@trustline-onboarder/sdk`. Because the wallet holds the user's
key, it onboards directly instead of redirecting.

`src/index.ts` shows the flow (`activateForClaim`): `detect` whether the user already holds the
asset; if not, `startOnboarding` in `direct` mode builds the sponsored claim, the wallet signs
the user's part, and submits. The sponsor adds its signature out of band (for example through the
issuer's approval server) before submission.

The code is illustrative and typechecked against the SDK; it is not run. Type-check it with:

```bash
pnpm --filter @trustline-onboarder/example-wallet typecheck
```
