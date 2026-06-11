import type { Transaction } from '@stellar/stellar-sdk';
import type { AssetRef, Mechanism } from '@trustline-onboarder/core';

export type { AssetRef, Mechanism } from '@trustline-onboarder/core';

/** The two networks this SDK targets. */
export type NetworkName = 'testnet' | 'public';

/**
 * Anything that can add the sponsor's signature to a transaction. Structurally matches the
 * `@trustline-onboarder/signer` `Signer` (and `LocalSigner`/`KmsSigner`), so a server adopter can
 * pass a KMS-backed signer without this package importing the signer at runtime.
 */
export interface SignerLike {
  publicKey(): string;
  sign(tx: Transaction): Promise<Transaction>;
}

/**
 * Bring-your-own sponsor — the account that pays trustline reserves so the user needs no XLM.
 * There is deliberately no hosted-sponsorship fallback: a remote "sign this for me" endpoint is a
 * signing oracle anyone could call to drain the sponsor. Adopters who cannot run a sponsor use
 * redirect mode instead (see {@link TrustlineOnboarderConfig.serviceUrl}).
 */
export type SponsorConfig =
  | { kind: 'keypair'; secret: string }
  | { kind: 'signer'; signer: SignerLike }
  | { kind: 'callback'; publicKey: string; sign: (xdr: string) => Promise<string> };

export interface TrustlineOnboarderConfig {
  network: NetworkName;
  /** Base URL of the hosted activation page, used by redirect mode. */
  serviceUrl?: string;
  /** Bring-your-own sponsor. Required for the direct (build/submit) path; optional for redirect. */
  sponsor?: SponsorConfig;
  /** Override the Horizon URL (defaults to the network's public Horizon). */
  horizonUrl?: string;
  /** Skip discovery and use this SEP-8 approval server for regulated assets. */
  approvalServerUrl?: string;
}

/** Whether an account already holds (and is authorized for) an asset. */
export interface DetectResult {
  hasTrustline: boolean;
  authorized: boolean;
}

/** The output of {@link TrustlineOnboarder.buildOnboardingTx}: an XDR awaiting the user's signature. */
export interface OnboardingPlan {
  /** Unsigned (issuer-approved, for regulated assets) transaction envelope, base64 XDR. */
  tx: string;
  /** Accounts whose signatures are still required before submission. */
  requiredSigners: string[];
  mechanism: Mechanism;
  /** Index of the issuer authorization op, when the asset is regulated. */
  issuerAuthOpIndex?: number;
  /** The resolved sponsor public key the reserve sandwich was built against. */
  sponsor: string;
  /** Network passphrase the transaction is built for. */
  network: string;
}

/** A submitted, settled activation. */
export interface SettledActivation {
  hash: string;
  explorerUrl: string;
}

/** Request to build the recipient-side activation transaction. */
export interface OnboardRequest {
  asset: AssetRef;
  /** The recipient/user account (Gxxx). */
  account: string;
  /** When set, claim this pending balance (claimable mechanism) instead of a trustline only. */
  balanceId?: string;
  /** Override the auto-picked mechanism. */
  mechanism?: Mechanism;
  /** Optional trustline limit. */
  limit?: string;
}

export interface StartOnboardingParams {
  asset: AssetRef;
  destination: string;
  amount?: string;
  balanceId?: string;
  returnUrl?: string;
  platform?: string;
  branding?: { logo?: string; primary?: string };
  /** Force a path. Defaults to `direct` when a sponsor is configured, else `redirect`. */
  prefer?: 'redirect' | 'direct';
}

export type StartOnboardingResult =
  | { mode: 'redirect'; url: string }
  | { mode: 'direct'; plan: OnboardingPlan };

/** Request to create a claimable balance addressed to a recipient who has no trustline yet. */
export interface SendRequest {
  asset: AssetRef;
  amount: string;
  recipient: string;
  sender: string;
  reclaimAfterSeconds?: number;
}
