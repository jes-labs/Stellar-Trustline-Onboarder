# Integration guide

How a **wallet** or an **exchange/broker** adopts the Trustline Onboarder to let users receive a
Stellar asset without manually setting up a trustline and without holding XLM for the reserve.

Everything here runs against the [`@trustline-onboarder/sdk`](../packages/sdk) package. Two
runnable, testnet-proven references accompany this guide:

- [`examples/wallet-integration`](../examples/wallet-integration) — the recipient flow.
- [`examples/exchange-integration`](../examples/exchange-integration) — the sender flow.

---

## 1. The model in one minute

A classic Stellar asset can only land in an account that holds an **authorized trustline** for it.
Establishing that trustline normally costs the user a reserve in XLM and an out-of-context "create
a trustline" prompt — the friction this project removes.

The SDK coordinates three signatures, and **never holds any key**:

| Signature | Who provides it | Where |
| --- | --- | --- |
| **User** | the recipient's wallet | browser / wallet app |
| **Sponsor** | you (bring-your-own), pays the reserve | your server, or a KMS |
| **Issuer** | the asset issuer's SEP-8 approval server | only for regulated assets |

`buildOnboardingTx` returns an unsigned transaction plus `requiredSigners`; each party signs its
part; `submit` adds the sponsor signature and sends it. There is **no hosted "sign for me"
endpoint** — a remote signing oracle would let anyone drain the sponsor. If you cannot run a
sponsor, use **redirect mode** (below) and let the hosted activation page sponsor within its own
gated session.

---

## 2. Install

```bash
pnpm add @trustline-onboarder/sdk
```

Construct one `TrustlineOnboarder` for your process:

```ts
import { TrustlineOnboarder } from '@trustline-onboarder/sdk';

const onboarder = new TrustlineOnboarder({
  network: 'testnet',                       // or 'public'
  serviceUrl: 'https://activate.you.example', // hosted activation page, for redirect mode
  sponsor: { kind: 'keypair', secret: process.env.SPONSOR_SECRET! }, // bring-your-own
});
```

### Sponsorship (bring-your-own)

The sponsor pays the trustline reserve so the user needs no XLM. Three kinds:

```ts
{ kind: 'keypair', secret }                       // dev / simple deployments
{ kind: 'signer', signer }                        // KMS/HSM — key never in process
{ kind: 'callback', publicKey, sign }             // custom signer
```

For a KMS-backed sponsor, use the server helpers:

```ts
import { sponsorFromSigner } from '@trustline-onboarder/sdk/server';
const onboarder = new TrustlineOnboarder({ network: 'public', sponsor: sponsorFromSigner(kmsSigner) });
```

Omit `sponsor` entirely and you can still use **redirect mode**; the direct build/submit calls
will throw `OnboardingError('no-sponsor')`.

---

## 3. Wallet integration (the recipient)

A wallet holds the user's key, so it builds, signs in-wallet, and submits. Full example:
[`examples/wallet-integration`](../examples/wallet-integration).

```ts
import { activateWithWallet } from '@trustline-onboarder/sdk/client';

// 1. Gate on detect — skip onboarding if the user already holds the asset.
const { hasTrustline } = await onboarder.detect({ account: userAddress, asset });
if (hasTrustline) return;

// 2. Build → sign in-wallet → submit. `sign` is your wallet's own signer.
const settled = await activateWithWallet(onboarder, { asset, account: userAddress }, sign);

// 3. Confirm before treating the user as onboarded.
const ok = await onboarder.verifyActivation({ account: userAddress, asset });
```

`sign` is `(xdr: string) => Promise<string>`. With Stellar Wallets Kit:

```ts
const sign = (xdr: string) =>
  kit.signTransaction(xdr, { address: userAddress }).then((r) => r.signedTxXdr);
```

Prefer not to build the transaction in-wallet? Redirect instead:

```ts
const { url } = await onboarder.startOnboarding({ asset, destination: userAddress, prefer: 'redirect' });
// open `url`
```

---

## 4. Exchange / broker integration (the sender)

An exchange typically does **not** hold the user's key. It has two options; full example:
[`examples/exchange-integration`](../examples/exchange-integration).

### A) Redirect — hand the user to the activation page

```ts
const result = await onboarder.startOnboarding({
  asset,
  destination: userAddress,
  amount: '100.00',
  platform: 'Acme Exchange',
  returnUrl: 'https://acme.example/withdraw/done',
  branding: { logo: 'https://acme.example/logo.svg', primary: '#4338CA' },
  prefer: 'redirect',
});
if (result.mode === 'redirect') redirect(result.url);
```

This deep-links into the hosted "Welcome to Stellar" page
([`apps/activation-ui`](../apps/activation-ui)), which is open source and theme-able.

### B) Send now, claim later — claimable balance

When you want the funds in flight immediately, create a claimable balance to a user who has no
trustline yet; the user claims it later with a sponsored trustline.

```ts
const built = await onboarder.buildSend({ asset, amount: '100', recipient: userAddress, sender: distributor });
// sign `built` with your distributor key and submit it; the user later runs the recipient flow with the balanceId
```

---

## 5. Regulated assets (MiCA)

For a MiCA-regulated issuer, the asset enforces `AUTH_REQUIRED`: a trustline must be **authorized
by the issuer** before it can hold the asset. The SDK handles this automatically:

- It reads the issuer's `auth_required` flag from Horizon and picks the regulated builders.
- It discovers the issuer's **SEP-8 approval server** from the issuer's `home_domain` →
  `stellar.toml` (`[[CURRENCIES]].approval_server`), or you pass `approvalServerUrl` explicitly.
- It POSTs the transaction for the issuer's signature. The approval server's response maps to
  typed outcomes:
  - `success` / `revised` → proceed (the issuer authorization is now signed);
  - `action_required` / `pending` → `OnboardingError('kyc')` — route the user to verification;
  - `rejected` → `OnboardingError('rejected')` — compliance declined.

The reference approval server ([`apps/approval-server`](../apps/approval-server)) demonstrates the
issuer side: it signs **only** issuer authorization (and MiCA admin ops — freeze, clawback) behind
a [`Signer`](../packages/signer) boundary so the issuer key can live in a KMS/HSM, gates each
authorization on a compliance check, and keeps an audit trail. It never holds or moves user funds.

Nothing else in your integration changes between unregulated and regulated assets — the same
`buildOnboardingTx` → sign → `submit` sequence applies; the issuer signature is obtained inside
`buildOnboardingTx`.

---

## 6. Error handling

All failures are `OnboardingError` with a `code`:

| code | meaning | typical handling |
| --- | --- | --- |
| `no-sponsor` | direct build/submit without a sponsor | configure a sponsor, or use redirect |
| `account-not-found` | recipient account does not exist on-chain | create/fund it first (see note) |
| `kyc` | issuer requires verification | send the user through KYC, retry |
| `rejected` | issuer compliance declined | surface a support path |
| `no-approval-server` | regulated asset, no discoverable approval server | pass `approvalServerUrl` |
| `failed` | network/other | retry / report |

> **Account existence.** The SDK requires the recipient account to already exist on-chain (it is a
> library, not a funding service). On testnet the examples Friendbot-fund accounts; on mainnet a
> brand-new account needs a sponsored `createAccount` before (or as part of) onboarding.

---

## 7. Going to production

See the [production checklist](./production-checklist.md) for the mainnet hardening steps —
sponsor key custody, fee handling, gating the hosted activation endpoints, and the rollout plan.
