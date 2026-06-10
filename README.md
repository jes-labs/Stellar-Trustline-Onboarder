# Trustline Onboarder

Trustline Onboarder is an ecosystem standard and an open-source reference implementation that
let exchanges, brokers, and wallets move users into Stellar classic assets without forcing a
manual trustline step, including the authorization layer a MiCA-regulated issuer needs.

Every primitive it relies on is live on Stellar mainnet today. Nothing on the critical path
depends on a draft protocol change.

## Why this exists

To hold a Stellar classic asset, an account must first carry a *trustline* for it, and each
trustline locks a base reserve of about 0.5 XLM. That requirement is invisible to product teams
and jarring to users. Someone withdrawing an asset from an exchange is interrupted by an
out-of-context prompt to "create a trustline" and to hold XLM they may not have. The flow
stalls, and a meaningful share of withdrawals are abandoned there.

The pain is sharpest for regulated assets. SG-FORGE issues EURCV, a MiCA-compliant euro
stablecoin, on Stellar, and distributes it through exchanges such as Bitpanda. MiCA requires the
issuer to vet holders, freeze balances, and claw assets back under order. On classic Stellar
that means an `AUTH_REQUIRED` asset with an authorization layer, so the issuer cannot simply let
anyone hold the asset and the exchange cannot offer a clean withdrawal. Today each team solves
this alone, with bespoke tooling.

Trustline Onboarder turns that into a shared, predictable pattern: a trustline-free onboarding
flow that works now, plus the issuer-side controls a regulated asset requires, packaged so an
adopter integrates it rather than rebuilds it.

## What it is

Two things, built in that order:

1. **A reference implementation.** Working TypeScript that performs the onboarding end to end on
   Stellar: the transaction builders, an issuer-side approval server, and the branded activation
   page a user lands on.
2. **A standard.** Once the interfaces are proven by the implementation and a pilot, they are
   distilled into a SEP (a Stellar Ecosystem Proposal) that other wallets, exchanges, and
   issuers implement the same way.

The approach is deliberately implementation-first. The standard is transcribed from interfaces
that already work, rather than written in the abstract and then fought by the code.

## How it works

The core idea is to never make the user think about a trustline or about XLM. The platform
detects that a destination cannot yet receive an asset and hands the user a short, sponsored
flow that establishes the trustline (and, for regulated assets, authorizes it) in the same
breath as receiving the funds.

Two properties make that possible, both using operations that are live on mainnet:

- **Sponsored reserves.** Every trustline is wrapped in a sponsorship "sandwich" so a sponsor,
  not the user, pays the reserve. The user needs no XLM.
- **Issuer authorization inline.** For a regulated `AUTH_REQUIRED` asset, the issuer's
  authorization is inserted into the very transaction that creates the trustline, and signed by
  the approval server after a compliance check. The trustline is born authorized.

### The three mechanisms

| | Mechanism | When to use | Status |
| - | --------- | ----------- | ------ |
| **C** | Claimable balance ("send now, activate later") | The universal default | Implemented and demoed |
| **A** | Authorize the trustline ("hold before receiving") | Regulated assets, or holding ahead of a withdrawal | Implemented and demoed |
| **B** | Temporary intermediate account | Specific custodial setups | Reserved (not implemented) |

Each mechanism is a transaction builder with a regulated and an unregulated variant. The exact
operation sequences, all composed from live operations:

**Mechanism C, the claim.** The sender creates a claimable balance to a recipient who has no
trustline. The recipient then claims it, creating the sponsored trustline in the same
transaction:

```
begin sponsoring (sponsor) → changeTrust (recipient) → end sponsoring (recipient) → claim (recipient)
```

For a regulated asset, one issuer operation is inserted before the claim, because a claim needs
an authorized trustline. The approval server signs it:

```
begin → changeTrust → end → setTrustLineFlags AUTHORIZED (issuer) → claim
```

**Mechanism A, hold before receiving.** A user establishes a sponsored, authorized trustline so
a later withdrawal settles with no trustline step:

```
begin sponsoring (sponsor) → changeTrust (user) → end sponsoring (user) [→ setTrustLineFlags (issuer), if regulated]
```

Because the trustline is created at authorization time, nothing here waits on the draft
preauthorization CAPs. The builders expose a switch for that future protocol path without
changing their public surface.

### End-to-end flow

```
 Exchange / broker          Activation page            Next API routes            Stellar
 (detects missing      →    (browser: connect     →    (server: build +      →    network
  trustline, redirects)      wallet, sign)              issuer approval,
                                                        submit)
```

The split is deliberate. Connecting a wallet and signing happen in the browser, because a wallet
is a browser extension and only the user can authorize. Building the transaction, calling the
issuer's approval server, and submitting to the network happen server-side, which keeps the
approval-server URL, the sponsor key, and Horizon configuration off the client.

## The regulated profile (MiCA)

For a regulated classic asset, the issuer needs four capabilities, all available today, and the
reference implementation provides each:

- **Vet holders.** `AUTH_REQUIRED` plus the approval server plus a KYC hook, so only cleared
  accounts receive an authorized trustline.
- **Freeze a holder.** `setTrustLineFlags` clears the authorized flag on one holder's trustline.
- **Claw back.** `clawback` recovers assets under regulatory order without touching the rest of
  the holder's wallet.
- **Audit.** Every authorize, freeze, and clawback is recorded with the actor, time, and reason.

The approval server is the heart of this profile. It is a SEP-8-style service that validates
each incoming transaction, applies the issuer's authorization signature only when the request is
a legitimate onboarding transaction and the holder is cleared, and never holds or moves user
funds. It is idempotent and replay-protected: the same transaction always yields the same
response and is never signed or audited twice.

## Architecture

A pnpm and Turborepo monorepo. Shared libraries do the chain work; the deployables compose them.

```
packages/
  core        Transaction builders for mechanisms A, B, C, the sponsorship sandwich, the MiCA
              operations (freeze, clawback), and transaction assembly and submission. Pure and
              network-free to build; the single source of truth for the operation sequences.
  signer      The issuer signing boundary. A Signer interface with a dev LocalSigner and a
              production KMS/HSM adapter, so the issuer key never lives in a server process.
  discovery   stellar.toml generation and parsing, and the onboarding service descriptor.
  sdk         The adopter-facing surface: detect a missing trustline, start onboarding, verify
              activation. This is the client side of the standard.

apps/
  approval-server   The issuer-side service: SEP-8-style /tx-approve, the compliance gate,
                    transaction validation, idempotency, and the MiCA admin endpoints.
  activation-ui     The "Welcome to Stellar" page: the full activation flow as a responsive,
                    themeable Next.js app, with the chain work behind Next API routes.
  demo              End-to-end testnet runners that exercise each mechanism.

examples/           Wallet and exchange integration samples.
```

### The signing boundary

The issuer's signature is the most valuable capability in the system, so it is tightly
contained. The approval server depends only on the `Signer` interface. In production the issuer
key sits behind a KMS or HSM and is reached through an adapter; it is never present in the server
process. The server will sign exactly one kind of onboarding operation, `setTrustLineFlags` that
sets the authorized flag on the issuer's own asset, and nothing else. Anything broader is
rejected before a signature is ever applied.

### Designed to become a standard

The public interfaces are built so the SEP can be transcribed from them. Three things are kept
stable and documented: the approval-server request and response shapes (the server side of the
standard), the SDK surface and the activation deep-link parameters (the client side), and the
operation sequences for each mechanism and profile (the reference flows). When those are settled
in code and proven by the demo and a pilot, the specification is a transcription of them.

## Standards alignment

Everything on the critical path uses operations that are final and live on mainnet:

- Claimable balances (CAP-23) for mechanism C.
- Sponsored reserves (CAP-33) so the user needs no XLM.
- Fine-grained authorization (CAP-18, final since Protocol 13) for the `AUTH_REQUIRED` state.
- Clawback (CAP-35) for the regulated profile.
- SEP-1 for discovery, SEP-8 for the regulated-assets approval interface, and SEP-10 / SEP-12
  as the auth and KYC hooks.

The draft proposals that would make protocol-level trustline preauthorization cleaner (CAP-32
and CAP-73) are treated as future optimizations, never as dependencies.

## Getting started

```bash
pnpm install
pnpm build       # build the libraries
pnpm typecheck
pnpm lint        # Biome
pnpm test        # Vitest unit tests
```

Run the end-to-end flows on Stellar testnet. They fund fresh keypairs via Friendbot, so no
secrets are needed:

```bash
pnpm demo            # unregulated Mechanism C: a zero-touch receive
pnpm demo:regulated  # regulated Mechanism C through the approval server, plus clawback, freeze, and the audit trail
pnpm demo:authorize  # regulated Mechanism A: hold before receiving
```

The regulated demos boot the approval server in-process. To run it standalone instead (set
`ISSUER_SECRET` and `ADMIN_TOKEN` via the environment):

```bash
pnpm --filter @trustline-onboarder/approval-server dev
```

Run the activation page locally:

```bash
pnpm --filter @trustline-onboarder/activation-ui dev   # http://localhost:3001/withdraw
```

See [`apps/activation-ui/README.md`](apps/activation-ui/README.md) for the page's configuration,
theming, and architecture.

## Status and roadmap

- **Phase 0, the Mechanism C spine.** Complete. A reproducible zero-touch receive on testnet:
  create a claimable balance to an account with no trustline, then claim it with a sponsored
  trustline, ending in a usable balance.
- **Phase 1, the approval server and the regulated path.** Complete and demo-proven on testnet:
  issuer-authorized claims (C) and hold-before-receiving (A) through a SEP-8-style approval
  server, with idempotent and replay-protected approvals, authenticated MiCA admin operations
  (freeze, clawback), and an audit trail.
- **Phase 2, the activation page.** Complete. The full eleven-screen flow as a responsive,
  token-themeable Next.js app, with the chain work behind Next API routes and the wallet
  integration behind a single interface.
- **Phase 3, the adopter SDK and discovery.** Next.
- **Phase 4, hardening and a controlled mainnet pilot**, after which the SEP is distilled from
  the working flows.

## License

Apache-2.0
