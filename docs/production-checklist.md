# Production checklist

The reference implementation runs end-to-end on **testnet** out of the box. This is the work to
take a deployment to **mainnet** safely. Items are grouped by concern; each notes what exists today
and what a production deployment must add.

## Network

- [x] **Network is env-driven.** `STELLAR_NETWORK=public` switches the server
  (`apps/activation-ui/lib/serverStellar.ts`) and the SDK (`network: 'public'`) to mainnet;
  `NEXT_PUBLIC_STELLAR_NETWORK=public` switches the wallet kit. Default is testnet.
- [ ] **Point at a production Horizon** (and ideally a private one) via `HORIZON_URL`. Public
  Horizon has rate limits unsuited to production volume.
- [ ] **Pin a known-good `@stellar/stellar-sdk`** and run against your own Horizon/Core where
  possible.

## Sponsor key custody

- [x] Sponsor signing is behind a `SponsorConfig` / `Signer` boundary — the key need not live in
  the app process.
- [ ] **Use a KMS/HSM signer**, not a raw secret. In the SDK: `sponsorFromSigner(kmsSigner)` from
  `@trustline-onboarder/sdk/server`. In activation-ui: replace the `Keypair.fromSecret` in
  `serverStellar.ts` with a KMS-backed `sign`.
- [ ] **Fund and monitor the sponsor.** Alert on low XLM; the sponsor pays ~0.5 XLM of reserve per
  trustline it sponsors. Cap total exposure.

## Gating the sponsor-spending endpoints

The hosted `build`/`submit`/`assets` routes spend the sponsor's reserves. Left open they are a
funding oracle. Implemented today (`apps/activation-ui/lib/guard.ts`):

- [x] **Origin allow-list** via `ALLOWED_ORIGINS`.
- [x] **Per-IP rate limit** via `RATE_LIMIT_PER_MINUTE` (build/submit gated tighter).

Still required for production:

- [ ] **Durable, shared rate-limit store** (Redis/Upstash) — the in-memory limiter is per-instance
  and resets on deploy.
- [ ] **Per-destination caps** — limit how many sponsored trustlines a single account/asset can
  trigger, to bound griefing.
- [ ] **Proof-of-work or captcha** on `build`, and ideally **session binding** so only a user who
  actually arrived from a partner redirect can spend the sponsor.
- [ ] **Abuse monitoring + a kill switch** to pause sponsorship.

## Account creation & fees

- [ ] **Sponsor account creation for brand-new accounts.** The flow assumes the recipient account
  already exists. A user with no account at all needs a sponsored `createAccount` before (or as
  part of) onboarding.
- [ ] **Fee-bump via the sponsor.** Today the user's account is the fee source. To fully honor "no
  XLM needed," wrap the user-signed transaction in a fee-bump paid by the sponsor.

## Regulated assets (MiCA)

- [x] Issuer authorization runs through a SEP-8 approval server behind a KMS-capable `Signer`, with
  compliance gating, idempotency/replay protection, and an audit trail (`apps/approval-server`).
- [ ] **Deploy the approval server with a real KYC/compliance backend** (the reference `Compliance`
  is in-memory) and the issuer key in a KMS.
- [ ] **Publish the issuer `stellar.toml`** with the correct `[[CURRENCIES]].approval_server` so the
  SDK can discover it (or configure `approvalServerUrl` explicitly).

## Observability & operations

- [ ] **Structured logging + error tracking** on the API routes (request id, outcome, latency,
  sponsor spend). None today.
- [ ] **Metrics**: onboarding success rate, KYC/rejection rates, sponsor balance, submission
  failures by Horizon result code.
- [ ] **Alerting** on sponsor balance, error-rate spikes, and rate-limit saturation.

## Pre-launch

- [ ] **Security review** of the signing boundaries and the gating, ideally external.
- [ ] **Load test** the gated endpoints and Horizon submission path.
- [ ] **Controlled mainnet pilot** with one wallet and one exchange/broker before general
  availability.
