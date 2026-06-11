# Example: Exchange integration

How an exchange or broker adopts `@trustline-onboarder/sdk` to onboard a user during a
withdrawal, without holding the user's key.

`src/index.ts` shows the two touch points:

1. **On a withdrawal request** (`onWithdrawalRequested`): `detect` whether the destination can
   already receive the asset. If it holds an authorized trustline, release the funds. Otherwise
   build an activation URL with `buildActivationUrl` and redirect the user there.
2. **When the user returns** (`onUserReturned`): `verifyActivation` confirms the trustline exists
   and is authorized before the funds are released.

The code is illustrative and typechecked against the SDK; it is not run. Type-check it with:

```bash
pnpm --filter @trustline-onboarder/example-exchange typecheck
```
