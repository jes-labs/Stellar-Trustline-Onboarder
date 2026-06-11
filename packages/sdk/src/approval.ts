import { StellarToml } from '@stellar/stellar-sdk';
import type { AssetRef } from '@trustline-onboarder/core';
import { OnboardingError } from './errors';
import { issuerHomeDomain } from './horizon';

/**
 * Resolve the SEP-8 approval server URL for a regulated asset. Follows the issuer's
 * `home_domain` to its stellar.toml and reads the matching currency's `approval_server`. A
 * relative value is resolved against the home domain. An explicit override short-circuits this.
 */
export async function resolveApprovalServer(
  horizonUrl: string,
  asset: AssetRef,
  override?: string,
): Promise<string> {
  if (override) return override;

  const domain = await issuerHomeDomain(horizonUrl, asset.issuer);
  if (!domain) {
    throw new OnboardingError(
      'no-approval-server',
      `issuer ${asset.issuer} has no home_domain to discover an approval server`,
    );
  }

  const toml = await StellarToml.Resolver.resolve(domain);
  const currency = (toml.CURRENCIES ?? []).find(
    (c) => c.code === asset.code && c.issuer === asset.issuer,
  );
  const url = currency?.approval_server;
  if (!url) {
    throw new OnboardingError(
      'no-approval-server',
      `no approval_server for ${asset.code} in ${domain}'s stellar.toml`,
    );
  }
  // SEP-8 mandates an absolute URL, but tolerate a relative path against the home domain.
  return url.startsWith('http') ? url : new URL(url, `https://${domain}`).toString();
}

/** Approval server response (SEP-8 shaped). */
interface ApprovalResponse {
  status?: string;
  tx?: string;
  message?: string;
}

/**
 * Submit the unsigned transaction to the approval server and return the issuer-signed XDR.
 * Non-success statuses become typed errors: `action_required`/`pending` → `kyc`, `rejected` →
 * `rejected`. The returned transaction may be revised, so it must be the one the user signs.
 */
export async function requestApproval(
  approvalUrl: string,
  xdr: string,
  _network: string,
): Promise<string> {
  let result: ApprovalResponse;
  try {
    const res = await fetch(approvalUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tx: xdr }),
    });
    result = (await res.json()) as ApprovalResponse;
  } catch {
    throw new OnboardingError('failed', 'could not reach the approval server');
  }

  switch (result.status) {
    case 'success':
    case 'revised':
      if (!result.tx) throw new OnboardingError('failed', 'approval returned no transaction');
      return result.tx;
    case 'action_required':
    case 'pending':
      throw new OnboardingError('kyc', result.message);
    case 'rejected':
      throw new OnboardingError('rejected', result.message);
    default:
      throw new OnboardingError('failed', result.message ?? 'approval failed');
  }
}
