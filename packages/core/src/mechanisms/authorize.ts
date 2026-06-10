import type { Account } from '@stellar/stellar-sdk';
import { wrapSponsored } from '../sponsorship';
import { assemble, type PlannedOp } from '../tx';
import type { AssetProfile, AssetRef, BuildOptions, BuiltTransaction } from '../types';
import { plannedChangeTrust, plannedIssuerAuthorize } from './_ops';

/**
 * Mechanism A — authorize the trustline. For a user who needs to hold an asset *before* a
 * withdrawal arrives. Establishes a sponsored trustline and, for regulated assets, authorizes it.
 */

export interface AuthorizeParams {
  asset: AssetRef;
  profile: AssetProfile;
  /** The user establishing the trustline — also the transaction source. */
  user: string;
  /** The account paying the trustline reserve. */
  sponsor: string;
  /** Optional trustline limit. */
  limit?: string;
  /**
   * Reserved switch for a future protocol-level preauthorization path (CAP-73 / CAP-32).
   * Has no effect today; the builder authorizes at trustline-creation time. Exposed so the
   * public API does not change when those CAPs land.
   */
  preauthorize?: boolean;
}

/**
 * Build the Mechanism A transaction.
 *
 *   begin(sponsor) → changeTrust(user) → end(user)
 *     → [regulated only] setTrustLineFlags(issuer)
 *
 * Unregulated requires signatures from the sponsor and the user. Regulated additionally requires
 * the issuer (via the approval server); {@link BuiltTransaction.issuerAuthOpIndex} points at it.
 */
export function buildAuthorize(
  params: AuthorizeParams,
  userAccount: Account,
  network: string,
  options?: BuildOptions,
): BuiltTransaction {
  if (params.preauthorize) {
    // The protocol-level preauthorization path is not finalized (CAP-73 / CAP-32 are draft).
    // We intentionally fall through to the trustline-creation-time authorization below so
    // nothing on the critical path depends on a draft CAP.
  }

  const sandwich: PlannedOp[] = wrapSponsored(
    [plannedChangeTrust(params.asset, params.user, params.limit)],
    { sponsor: params.sponsor, sponsored: params.user },
  );

  if (params.profile === 'unregulated') {
    return assemble({
      source: userAccount,
      network,
      mechanism: 'authorize',
      operations: sandwich,
      requiredSigners: [params.sponsor, params.user],
      options,
    });
  }

  const issuerAuthOpIndex = sandwich.length;
  return assemble({
    source: userAccount,
    network,
    mechanism: 'authorize',
    operations: [...sandwich, plannedIssuerAuthorize(params.asset, params.user)],
    requiredSigners: [params.sponsor, params.user, params.asset.issuer],
    issuerAuthOpIndex,
    options,
  });
}
