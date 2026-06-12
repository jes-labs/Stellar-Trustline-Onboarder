# SEP-XXXX: Trustline Onboarding

## Preamble

```
SEP: To Be Assigned
Title: Trustline Onboarding
Author: JesLabs
Track: Standard
Status: Draft
Created: 2026-06-11
Updated: 2026-06-11
Version: 0.1.0
Discussion: https://github.com/stellar/stellar-protocol/discussions (to be opened)
Implementation: https://github.com/jes-labs/Stellar-Trustline-Onboarder
```

## Simple Summary

A standard way for exchanges, brokers, custodians, and wallets to move a Stellar classic asset to
a user who has no trustline for it — without the user manually creating a trustline and without the
user holding XLM for the trustline reserve. The standard defines the transactions, the issuer
authorization interface for regulated assets, the discovery metadata, and the redirect ("activate
assets") hand-off, so that any participant can implement the flow predictably.

## Dependencies

This SEP composes existing, finalized protocol features and ecosystem standards. It introduces no
new protocol change and depends on:

- **CAP-0023** — Claimable Balances (Mechanism C).
- **CAP-0033** — Sponsored Reserves (so the recipient needs no XLM).
- **CAP-0018** — Fine-Grained Control of Authorization (`SetTrustLineFlags`), final since Protocol
  13, for the regulated (`AUTH_REQUIRED`) profile.
- **CAP-0035** — Asset Clawback, for the regulated profile's lifecycle (informative).
- **SEP-0001** — `stellar.toml`, for discovery.
- **SEP-0008** — Regulated Assets, whose `/tx-approve` request/response shape this SEP reuses for
  issuer authorization.
- **SEP-0010** — Stellar Authentication, and **SEP-0012** — KYC API, as the authentication and
  verification hooks for the regulated profile (informative).

**CAP-0073** (Authorize Trustline) and **CAP-0032** are forward-looking optimizations that would
let an issuer pre-authorize a trustline at the protocol level. This SEP is designed so that an
implementation can adopt them later behind the same interface, but does not depend on them.

## Motivation

Receiving a classic Stellar asset requires the recipient's account to hold an authorized trustline
for that asset. This creates two recurring blockers:

1. **Unintuitive UX.** Mid-withdrawal, a user is shown an out-of-context "create a trustline"
   prompt by their wallet or exchange. Withdrawal flows stall, and support burden rises. Exchanges
   and institutional partners cannot offer a predictable native-asset withdrawal experience.
2. **No standard for the regulated case.** For a MiCA-regulated issuer, a classic asset must be
   `AUTH_REQUIRED`: the issuer has to authorize each trustline. There is no agreed interface for an
   exchange or wallet to request that authorization as part of onboarding, so each integration is
   bespoke.

Point solutions exist, but no standard does, so custodians, wallets, exchanges, and issuers cannot
interoperate. This SEP specifies the flow end to end so they can.

## Abstract

An asset is delivered to a trustline-less recipient through one of three **mechanisms**:

- **(A) Authorize** — establish a *sponsored* trustline for the recipient (and, for a regulated
  asset, authorize it), so the recipient can hold the asset. Useful when the recipient must hold
  before a transfer arrives.
- **(B) Intermediate account** — route the transfer through a temporary, pre-configured account
  (OPTIONAL; informative in this version).
- **(C) Claimable balance** — the universal default. The sender creates a claimable balance to the
  recipient (who needs no trustline yet); the recipient later claims it with a *sponsored*
  trustline, in a single transaction.

Each mechanism has an **unregulated** and a **regulated** profile. A regulated profile inserts an
issuer authorization operation that the issuer signs through a SEP-8-aligned **approval server**.

A **sponsor** account pays every reserve via CAP-33 sponsorship, so the recipient needs no XLM.
Signatures are collected from the parties that own the keys — the recipient (their wallet), the
sponsor (the onboarding service), and, for regulated assets, the issuer (its approval server) — and
**no party holds another party's key**. Implementations discover an asset's profile and approval
server from the issuer's `stellar.toml`, and MAY offer a hosted redirect ("activate assets") page
parameterized by a documented set of query parameters.

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT",
"RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in
[RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

All transactions are classic Stellar transactions. All XDR is base64-encoded transaction
envelopes. `G...` denotes a Stellar public key (`MuxedAccount`s are out of scope for this version).

### 1. Roles

- **Recipient** (a.k.a. user) — the account that will hold the asset. Controls its own signing key,
  typically in a wallet. `G...`.
- **Sender** — the party transferring the asset (e.g. an exchange's distribution account). Relevant
  to Mechanism C.
- **Issuer** — the account that issues the asset. For a regulated asset it runs an **approval
  server**.
- **Sponsor** — the account that pays reserves so the recipient needs no XLM. Operated by the
  **onboarding service**.
- **Onboarding service** — the software (library, server, or hosted page) that builds the
  transactions and coordinates signatures. It MUST NOT hold the recipient's or issuer's keys.

### 2. Asset profiles

An asset is one of:

- **Unregulated** — the issuer does NOT set `AUTH_REQUIRED`. A trustline can hold the asset as soon
  as it exists.
- **Regulated** — the issuer sets `AUTH_REQUIRED` (and typically `AUTH_REVOCABLE`, and MAY enable
  clawback). A trustline MUST be authorized by the issuer before it can hold the asset.

An onboarding service MUST determine the profile authoritatively from the issuer account's `flags`
(`auth_required`) as reported by Horizon, and MUST NOT rely solely on cached `stellar.toml`
metadata when deciding whether issuer authorization is required.

### 3. The sponsorship sandwich

Operations that create reserves for the recipient MUST be wrapped so the **sponsor** pays, per
CAP-33:

```
BeginSponsoringFutureReserves(sponsoredId = <sponsored>)   source: <sponsor>
  ... inner operations ...
EndSponsoringFutureReserves                                 source: <sponsored>
```

The `Begin` operation is sourced by the sponsor; the `End` operation MUST be sourced by the
sponsored account. Both the sponsor and the sponsored account therefore MUST sign the transaction.

### 4. Mechanisms

The transaction source account provides the fee and sequence number. Unless stated otherwise, the
source is the **recipient**. Operation sources are listed explicitly; an operation with no listed
source inherits the transaction source.

#### 4.1 Mechanism A — Authorize (sponsored trustline)

Establishes a sponsored trustline for the recipient. For a regulated asset, the issuer authorizes
it in the same transaction.

Unregulated:

```
BeginSponsoringFutureReserves(sponsoredId = recipient)   source: sponsor
ChangeTrust(asset)                                        source: recipient
EndSponsoringFutureReserves                               source: recipient
```
Required signers: `{ sponsor, recipient }`.

Regulated (adds the issuer authorization):

```
BeginSponsoringFutureReserves(sponsoredId = recipient)   source: sponsor
ChangeTrust(asset)                                        source: recipient
EndSponsoringFutureReserves                               source: recipient
SetTrustLineFlags(trustor = recipient, asset,
                  setFlags = AUTHORIZED)                  source: issuer
```
Required signers: `{ sponsor, recipient, issuer }`. The index of the `SetTrustLineFlags` operation
MUST be communicated to the caller (see §7) so the approval server can locate the operation it
signs.

#### 4.2 Mechanism C — Claimable balance

**Sender side** — create a claimable balance to a recipient who has no trustline:

```
CreateClaimableBalance(asset, amount, claimants = [
  Claimant(recipient, predicate),
  // OPTIONAL reclaim path:
  Claimant(sender, NOT predicate)
])                                                        source: sender
```
Required signers: `{ sender }`. The resulting **balance id** is derivable from the built (unsigned)
transaction and MUST be conveyed to the recipient out of band (e.g. via the redirect parameters in
§6).

`predicate` SHOULD be `unconditional` for a plain "send now, claim anytime" flow. An implementation
MAY use `BEFORE_RELATIVE_TIME(window)` to bound the claim and grant the sender a reclaim path after
the window, as shown.

**Recipient side, unregulated** — claim with a sponsored trustline in one transaction:

```
BeginSponsoringFutureReserves(sponsoredId = recipient)   source: sponsor
ChangeTrust(asset)                                        source: recipient
EndSponsoringFutureReserves                               source: recipient
ClaimClaimableBalance(balanceId)                          source: recipient
```
Required signers: `{ sponsor, recipient }`.

**Recipient side, regulated** — the issuer MUST authorize the trustline before the claim:

```
BeginSponsoringFutureReserves(sponsoredId = recipient)   source: sponsor
ChangeTrust(asset)                                        source: recipient
EndSponsoringFutureReserves                               source: recipient
SetTrustLineFlags(trustor = recipient, asset,
                  setFlags = AUTHORIZED)                  source: issuer
ClaimClaimableBalance(balanceId)                          source: recipient
```
Required signers: `{ sponsor, recipient, issuer }`.

#### 4.3 Mechanism B — Intermediate account (OPTIONAL)

An implementation MAY route a transfer through a temporary account that already trusts the asset,
forward the asset to the recipient once the recipient's trustline exists, and then merge the
temporary account. This version specifies Mechanisms A and C normatively; Mechanism B is
informative and reserved for a future revision.

### 5. The onboarding request (transaction build contract)

An onboarding service builds a transaction for one of the mechanisms above. The request identifies:

| Field | Required | Meaning |
| --- | --- | --- |
| `asset` | yes | The asset: a 1–12 char `code` and the `issuer` account. |
| `account` | yes | The recipient `G...`. |
| `sponsor` | yes | The sponsor `G...` that pays the reserve. |
| `balanceId` | when claiming | Selects Mechanism C (claim); absent selects Mechanism A. |
| `mechanism` | no | Explicit override; otherwise auto-selected from `balanceId`. |
| `limit` | no | Trustline limit. |

The service MUST return, alongside the unsigned transaction XDR:

- `network` — the network passphrase the transaction is built for;
- `requiredSigners` — the set of accounts whose signatures are still required;
- `mechanism` — the mechanism used;
- `issuerAuthOpIndex` — the index of the issuer authorization operation, present **iff** the asset
  is regulated.

The recipient account MUST exist on-chain to be the transaction source. For a brand-new recipient,
the service MAY first sponsor a `CreateAccount` (out of scope for this version's normative text; see
Security Concerns).

### 6. Redirect ("activate assets") parameters

A sender (exchange/broker) MAY hand a user to a hosted activation page instead of building the
transaction itself. The hand-off is an HTTP(S) URL whose query parameters are:

| Param | Required | Meaning |
| --- | --- | --- |
| `asset` | yes | Asset code, e.g. `EURC`. |
| `issuer` | yes | Asset issuer `G...`. |
| `destination` | recommended | Recipient account `G...`. |
| `amount` | no | Pending amount to claim/display. |
| `balanceId` | when claiming | Claimable balance id (Mechanism C). |
| `returnUrl` | no | Where "return to platform" sends the user. |
| `platform` | no | Display name of the referring platform. |
| `logo` | no | Referring platform's logo URL (display). |
| `primary` | no | Brand color override, `#RRGGBB` (display). |

Receivers MUST validate and sanitize every parameter and MUST treat unknown or malformed values as
absent. `logo` and `primary` are presentation-only and MUST NOT affect transaction construction.
Implementations SHOULD encode `#` as `%23` in `primary`.

### 7. Issuer authorization (regulated assets)

For a regulated asset, the issuer authorization operation (§4) MUST be signed by the issuer. The
onboarding service obtains that signature from the issuer's **approval server**, reusing the
SEP-8 `/tx-approve` interface.

**Request** — `POST {approval_server}` with `Content-Type: application/json`:

```json
{ "tx": "<base64 transaction envelope>" }
```

**Response** — a JSON object with a `status` field, interpreted as in SEP-8:

| `status` | Meaning | Onboarding action |
| --- | --- | --- |
| `success` | Approved as submitted; `tx` is signed. | Proceed with `tx`. |
| `revised` | Approved with changes; `tx` is the revised, signed transaction. | Proceed with `tx`. |
| `pending` | Not yet decided. | Surface "verification in progress". |
| `action_required` | The trustor must complete an action (e.g. KYC). | Route the user to verification. |
| `rejected` | Denied; `error` describes why. | Surface a compliance failure. |

The approval server:

- MUST validate that the transaction contains only operations it is willing to authorize, and MUST
  sign **only** the issuer authorization operation(s) (`SetTrustLineFlags` setting `AUTHORIZED`) for
  its own asset. It MUST NOT sign any operation that moves user funds.
- MUST gate authorization on the trustor having passed the issuer's compliance checks; when not
  passed it MUST return `action_required` (or `pending`).
- MUST be idempotent and replay-protected: the same transaction MUST yield the same response and
  MUST NOT be signed or audited more than once. Keying on the transaction hash (which is stable
  across signing) is RECOMMENDED.
- SHOULD maintain an audit trail of authorizations.

Because an `action_required`/`pending`/`rejected` outcome may revise the transaction, issuer
approval MUST be obtained **before** the recipient and sponsor sign (see §9).

### 8. Discovery

An onboarding service discovers an asset's profile and approval server from the issuer's
`stellar.toml` (SEP-1), located via the issuer account's `home_domain`.

The issuer's `stellar.toml` `[[CURRENCIES]]` entry for the asset:

- MUST include `code` and `issuer`.
- MUST, for a regulated asset, set `regulated = true` and provide `approval_server` (a fully
  qualified URL), per SEP-8.
- MAY advertise onboarding support with:
  - `onboarding_server` — the endpoint that builds onboarding transactions (when the issuer hosts
    one);
  - `onboarding_mechanisms` — an array drawn from `["authorize", "claimable", "intermediate"]`.

A consumer SHOULD treat a relative `approval_server` value as relative to the issuer's home domain,
but issuers MUST publish absolute URLs per SEP-8.

### 9. Signing and submission

Signatures are independent in Stellar and MAY be added in any order, **except** that a regulated
transaction MUST be sent to the approval server first, because approval MAY revise it. The
RECOMMENDED order is:

1. **Build** the unsigned transaction (onboarding service).
2. **Issuer authorization** (regulated only): submit to the approval server (§7); use the returned
   (possibly revised) transaction thereafter.
3. **Recipient signature**: the recipient's wallet signs.
4. **Sponsor signature**: the sponsor signs.
5. **Submit** to the network.

An implementation MAY collect the sponsor signature at build time and the recipient signature last;
the only hard ordering constraint is that issuer approval precedes any signature that would be
invalidated by a revision. No participant MUST ever transmit a private key to another participant.

The sponsor MAY also be the fee source via a fee-bump transaction so the recipient pays no XLM at
all; otherwise the recipient's account is the fee source and pays only the (negligible) network
fee.

### 10. Outcomes

An onboarding implementation MUST surface these terminal outcomes to the user. The codes are
normative; their presentation is not.

| Outcome | Cause |
| --- | --- |
| `success` | The trustline exists (and is authorized); any claim settled. |
| `kyc` | Regulated asset requires the trustor to complete verification (`action_required`/`pending`). |
| `rejected` | Issuer compliance denied authorization (`rejected`). |
| `expired` | A claim failed because the claimable balance is gone or its predicate is unmet. |
| `no-wallet` | No signing wallet is available to the recipient. |
| `failed` | Any other failure. The recipient MUST NOT be charged a reserve on failure. |

A caller verifies success by confirming the recipient holds an authorized trustline for the asset
(e.g. via Horizon `accounts` balances: the asset line is present and, for a regulated asset,
`is_authorized` is true).

### 11. Regulated lifecycle (MiCA)

The regulated profile makes a MiCA-compliant lifecycle possible. Beyond onboarding authorization,
the issuer (through privileged, authenticated operations on its own account — NOT part of the
onboarding flow) MAY:

- **Revoke / freeze** a trustline's authorization (`SetTrustLineFlags` clearing `AUTHORIZED`), and
- **Claw back** issued amounts (`Clawback`, CAP-35) when the issuer enabled clawback.

These operations MUST be authenticated and audited, and MUST be reachable only by the issuer. They
are specified here only to establish that the authorization layer this SEP defines is sufficient for
the full regulated asset lifecycle.

## Design Rationale

**Why a sponsored trustline rather than requiring XLM.** The reserve requirement is the friction.
CAP-33 lets a sponsor pay it transparently, so the recipient needs no XLM and sees no reserve. The
sponsorship sandwich is the minimal, finalized way to express this and requires only the sponsor and
sponsored signatures.

**Why claimable balances as the universal default.** Mechanism C lets value be *sent now* to a
recipient who has *no trustline at all*, decoupling the transfer from onboarding. It works today on
mainnet with no protocol change and degrades gracefully: the recipient claims whenever they are
ready, paying no reserve.

**Why reuse SEP-8 for issuer authorization.** Regulated assets already have a standard approval
interface in SEP-8. Rather than invent a parallel one, this SEP constrains SEP-8 to the onboarding
case: the approval server signs only the issuer authorization operation, gates on KYC, and is
idempotent. Existing SEP-8 tooling and mental models carry over.

**Why bring-your-own sponsor and no hosted signing oracle.** The sponsor pays real reserves. A
remote "sign/sponsor this for me" endpoint callable by anyone is a signing oracle that could be
spammed to exhaust the sponsor's XLM or coax unintended signatures. The standard therefore keeps
sponsorship a local responsibility of the onboarding service. A party that cannot run a sponsor uses
the redirect hand-off (§6) to a hosted page that sponsors within its own gated session, never an
open API.

**Why issuer approval before other signatures.** SEP-8 approval may *revise* the transaction
(`revised`), which invalidates any prior signature. Ordering approval first avoids re-collection.

**Why CAP-73 is a dependency-free optimization.** CAP-73 / CAP-32 would let an issuer pre-authorize
a trustline at the protocol level, removing the per-onboarding `SetTrustLineFlags` round-trip. They
are draft. This SEP authorizes at trustline-creation time using finalized CAP-18 semantics, and is
structured (`issuerAuthOpIndex`, the approval interface) so an implementation can switch to a
protocol-level path behind the same surface once those CAPs land.

**Why the redirect parameters are presentation-agnostic.** Branding parameters (`logo`, `primary`)
never influence transaction construction, so a malicious referrer cannot use them to alter what is
signed — only how the page looks.

## Security Concerns

- **Sponsor reserve exhaustion.** Any endpoint that triggers a sponsored reserve is a funding
  oracle. Implementations MUST gate such endpoints (origin allow-listing, rate limiting,
  per-destination caps, and ideally session binding or proof-of-work) and SHOULD monitor sponsor
  balance and provide a kill switch. The standard's "no hosted sponsorship API" stance (Design
  Rationale) is the primary mitigation.
- **Key custody / signing boundaries.** The onboarding service MUST NOT hold the recipient's or
  issuer's keys. The recipient signs in their wallet; the issuer signs in its approval server,
  which SHOULD keep the issuer key in an HSM/KMS. The sponsor key SHOULD likewise be HSM/KMS-backed
  in production.
- **Approval-server replay and forgery.** The approval server MUST validate the entire transaction
  (not just the operation it signs), MUST sign only its own `SetTrustLineFlags` operation, and MUST
  be idempotent/replay-protected to avoid double authorization or audit.
- **Account existence and fees.** The recipient account must exist to source the transaction.
  Sponsoring `CreateAccount` for brand-new accounts and/or using a sponsor fee-bump avoids the
  recipient needing any XLM; implementations that omit these MUST clearly document the residual XLM
  requirement.
- **Claim predicate evaluation.** Consumers displaying or acting on claimable balances MUST
  evaluate the claimant predicate (`unconditional`, `abs_before`, composites) against current time;
  a predicate that is not yet (or no longer) satisfied MUST NOT be presented as immediately
  claimable.
- **Redirect phishing.** The activation page is a redirect target; deployments SHOULD make the
  "secured by" provenance clear and MUST validate `returnUrl`/`destination`/`issuer` before acting
  on them.
- **Regulated clawback trust.** Recipients of clawback-enabled assets are trusting the issuer; this
  is inherent to the regulated profile and MUST be disclosed by integrators as appropriate.

## Changelog

- `0.1.0` (2026-06-11) — Initial draft. Mechanisms A and C (unregulated and regulated profiles),
  the sponsorship sandwich, the SEP-8-aligned issuer-authorization interface, `stellar.toml`
  discovery fields, the redirect parameters, the signing/submission ordering, and the
  outcome/security model. Mechanism B reserved as informative.

## Implementations

- **Reference implementation** — `@trustline-onboarder/*` (Apache-2.0):
  - `core` — transaction builders for Mechanisms A and C, both profiles (the operation sequences in
    §4).
  - `approval-server` — the SEP-8-aligned issuer authorization server (§7), with compliance gating,
    idempotency, audit, and the regulated lifecycle operations (§11).
  - `sdk` — the adopter SDK: detect, build, submit, verify, asset/claimable discovery, and the
    redirect builder (§5, §6, §8).
  - `activation-ui` — the hosted "Welcome to Stellar" activation page (§6).
  - `examples/` — runnable wallet and exchange integrations.
- Demonstrated end-to-end on the Stellar test network.
