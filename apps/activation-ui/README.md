# Activation UI — "Welcome to Stellar"

The page a user lands on, mid-withdrawal, after an exchange or broker redirects them. It lets
them receive a Stellar asset without manually setting up a trustline, and without holding XLM
for the reserve. The audience is often non-technical and mid-task, so the page is deliberately
calm, plain-spoken, and quick.

It is a responsive web page built with Next.js (App Router) and Tailwind. There is one layout
that reflows from desktop to phone — no device chrome, no separate mobile build.

## The flow

A single state machine drives eleven screens inside one shared card:

```
welcome → connect → review → approve → processing → success
                       └─ edge states: failed · kyc · rejected · expired · no-wallet
```

`welcome` introduces the asset and reassures about cost. `connect` lists wallet options.
`review` states plainly what will happen (activate, and claim the pending amount). `approve`
waits on the wallet, `processing` on the network, `success` confirms with the balance. The five
edge states surface real outcomes: a generic failure, a KYC requirement, a compliance
rejection, an expired claim, and no injected wallet.

## Architecture

The work is split between the browser and the server, deliberately:

- **Browser:** connecting a wallet and signing a transaction. A wallet is a browser extension,
  so this can only happen client-side.
- **Server (`app/api/activation/*`):** building the unsigned transaction, running the SEP-8
  issuer approval, and submitting to the network. This keeps the approval-server URL, sponsor
  key, and Horizon configuration off the client and avoids CORS.

```
lib/
  types.ts          screens, wallet ids, the per-session config
  config.ts         parse + validate redirect query params
  wallets.ts        wallet definitions (static)
  statusScreens.ts  copy + shape for every status screen
  backend.ts        ActivationBackend interface + the default HttpBackend
  machine.ts        the reducer + useActivation hook
components/activation/
  ActivationShell   top bar (broker slot + secured lockup), card, footer
  steps/            Welcome, ConnectWallet, Review, StatusScreen
  icons.tsx         the inline SVG icon set
  ...
app/
  withdraw/page.tsx       reads config server-side, renders the flow
  api/activation/build    build + issuer approval
  api/activation/submit   network submission
```

The `ActivationBackend` interface is the seam to the chain. The page never builds or submits a
transaction itself; it drives the backend. Today the default `HttpBackend` connects to a demo
address and the API routes simulate the chain. Wiring real Freighter signing and
`@trustline-onboarder/core` building is a drop-in behind that interface, with no screen changes.

## Configuration

The referring platform sets these on the redirect URL (all optional except where noted):

| Param | Meaning |
| ----- | ------- |
| `asset` | Asset code shown throughout, e.g. `EURC`. Defaults to `USDC`. |
| `amount` | Pending amount to claim. Empty hides the claim row. |
| `platform` | Name of the platform the user is withdrawing from. |
| `destination` | Recipient account (`G...`). |
| `issuer` | Asset issuer account (`G...`). |
| `balanceId` | Claimable balance id, when the flow is a claim. |
| `returnUrl` | Where "Return to platform" sends the user. |
| `logo` | Broker logo URL for the top-bar slot. |
| `primary` | Hex override for the brand color, e.g. `%234338CA`. |
| `simulate` | QA only: force an edge state (`failed`, `kyc`, `rejected`, `expired`, `no-wallet`). |

Example:

```
/withdraw?asset=EURC&amount=120.00&platform=Acme%20Exchange&returnUrl=https://acme.example/done
```

## Theming

Every brandable value is a design token in `app/globals.css` (`@theme`), mapped onto Tailwind
utilities. A broker re-themes by overriding the primary color — pass `primary` on the URL and
the page sets `--color-indigo` on the root, so every indigo utility follows. Type is set in
three families via `next/font`: Space Grotesk (headings), Inter (body), JetBrains Mono
(addresses, asset codes, balances).

## Develop

```bash
pnpm --filter @trustline-onboarder/activation-ui dev   # http://localhost:3001/withdraw
```
