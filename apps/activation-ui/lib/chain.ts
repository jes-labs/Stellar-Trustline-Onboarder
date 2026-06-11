import { Keypair } from '@stellar/stellar-sdk';
import {
  type AssetRef,
  type BuiltTransaction,
  buildAuthorize,
  buildClaimRegulated,
  buildClaimUnregulated,
  loadAccount,
  parseTransaction,
  submit,
} from '@trustline-onboarder/core';
import { serverChainConfig } from './server-config';
import type { ActivationConfig, ActivationErrorCode } from './types';

/** A chain failure tagged with the screen the UI should show. */
export class ChainError extends Error {
  constructor(
    readonly code: ActivationErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ChainError';
  }
}

export interface BuildResult {
  /** Unsigned by the user: the sponsor (and issuer, if regulated) have already signed. */
  xdr: string;
  networkPassphrase: string;
}

/**
 * Build the activation transaction the user will sign. A claimable balance id selects the claim
 * flow (mechanism C); its absence selects authorize (mechanism A). For a regulated asset the
 * transaction is routed through the issuer's approval server for the authorization signature.
 * The sponsor signs here; the user adds the final signature in their wallet.
 */
export async function buildActivationTx(
  config: ActivationConfig,
  address: string,
  sessionToken?: string,
): Promise<BuildResult> {
  const cfg = serverChainConfig();
  if (!config.issuer) throw new ChainError('failed', 'missing asset issuer');

  const sponsor = Keypair.fromSecret(cfg.sponsorSecret);
  const asset: AssetRef = { code: config.assetCode, issuer: config.issuer };
  const regulated = Boolean(cfg.approvalServerUrl);
  const source = await loadAccount(cfg.horizonUrl, address);

  let built: BuiltTransaction;
  if (config.balanceId) {
    const params = {
      asset,
      recipient: address,
      sponsor: sponsor.publicKey(),
      balanceId: config.balanceId,
    };
    built = regulated
      ? buildClaimRegulated(params, source, cfg.network)
      : buildClaimUnregulated(params, source, cfg.network);
  } else {
    built = buildAuthorize(
      {
        asset,
        profile: regulated ? 'regulated' : 'unregulated',
        user: address,
        sponsor: sponsor.publicKey(),
      },
      source,
      cfg.network,
    );
  }

  let xdr = built.xdr;
  if (regulated && cfg.approvalServerUrl) {
    xdr = await requestIssuerApproval(cfg.approvalServerUrl, xdr, sessionToken);
  }

  const tx = parseTransaction(xdr, cfg.network);
  tx.sign(sponsor);
  return { xdr: tx.toXDR(), networkPassphrase: cfg.network };
}

/** Send the transaction to the issuer's SEP-8 approval server and return the issuer-signed XDR. */
async function requestIssuerApproval(
  approvalServerUrl: string,
  xdr: string,
  sessionToken?: string,
): Promise<string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  const res = await fetch(`${approvalServerUrl.replace(/\/$/, '')}/tx-approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tx: xdr }),
  });
  const result = (await res.json()) as { status?: string; tx?: string };

  if (result.status === 'action_required') throw new ChainError('kyc');
  if (result.status === 'rejected') throw new ChainError('rejected');
  if ((result.status === 'revised' || result.status === 'success') && result.tx) return result.tx;
  throw new ChainError('failed', `unexpected approval status: ${result.status}`);
}

export interface SubmitResult {
  txHash: string;
  explorerUrl: string;
}

/** Submit the fully signed transaction to Horizon. */
export async function submitActivationTx(signedXdr: string): Promise<SubmitResult> {
  const cfg = serverChainConfig();
  const tx = parseTransaction(signedXdr, cfg.network);
  try {
    const res = await submit(cfg.horizonUrl, tx);
    return { txHash: res.hash, explorerUrl: `${cfg.explorerTxBase}${res.hash}` };
  } catch (err) {
    throw mapSubmitError(err);
  }
}

// A claim against a balance that is gone (claimed or reclaimed) reads as "expired"; anything
// else is the generic failure.
function mapSubmitError(err: unknown): ChainError {
  const codes = resultCodes(err);
  if (codes.some((c) => c.toLowerCase().includes('claimable_balance'))) {
    return new ChainError('expired', 'the claimable balance is no longer available');
  }
  return new ChainError('failed', 'transaction submission failed');
}

function resultCodes(err: unknown): string[] {
  const extras = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
    ?.response?.data?.extras?.result_codes;
  if (!extras || typeof extras !== 'object') return [];
  const { transaction, operations } = extras as {
    transaction?: string;
    operations?: string[];
  };
  return [transaction, ...(operations ?? [])].filter((c): c is string => typeof c === 'string');
}
