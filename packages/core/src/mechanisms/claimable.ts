import { type Account, Claimant, Operation } from '@stellar/stellar-sdk';
import { toAsset } from '../network';
import { wrapSponsored } from '../sponsorship';
import { assemble, type PlannedOp } from '../tx';
import type { AssetRef, BuildOptions, BuiltTransaction } from '../types';
import { plannedChangeTrust, plannedIssuerAuthorize } from './_ops';

/**
 * Mechanism C — claimable balance. The universal "send now, activate later" default.
 * Works today with no protocol change; for regulated assets it composes with the approval
 * server at claim time.
 */

export interface CreateClaimableBalanceParams {
  asset: AssetRef;
  amount: string;
  /** The end user who will claim the balance. */
  recipient: string;
  /** The account creating (and funding) the claimable balance — also the transaction source. */
  sender: string;
  /**
   * Optional reclaim window in seconds. When set, the recipient may claim before the window
   * elapses and the sender may reclaim afterwards. When omitted, the recipient claim is
   * unconditional.
   */
  reclaimAfterSeconds?: number;
}

/**
 * Sender side: build the transaction that creates a claimable balance addressed to a recipient
 * who does not need a trustline yet. Sign with the sender, submit, then read the resulting
 * balance id via {@link predictBalanceId} or from the transaction result.
 */
export function buildCreateClaimableBalance(
  params: CreateClaimableBalanceParams,
  senderAccount: Account,
  network: string,
  options?: BuildOptions,
): BuiltTransaction {
  const asset = toAsset(params.asset);
  let claimants: Claimant[];
  if (params.reclaimAfterSeconds && params.reclaimAfterSeconds > 0) {
    const window = String(params.reclaimAfterSeconds);
    claimants = [
      new Claimant(params.recipient, Claimant.predicateBeforeRelativeTime(window)),
      new Claimant(
        params.sender,
        Claimant.predicateNot(Claimant.predicateBeforeRelativeTime(window)),
      ),
    ];
  } else {
    claimants = [new Claimant(params.recipient, Claimant.predicateUnconditional())];
  }

  const op: PlannedOp = {
    op: Operation.createClaimableBalance({ asset, amount: params.amount, claimants }),
    type: 'createClaimableBalance',
  };

  return assemble({
    source: senderAccount,
    network,
    mechanism: 'claimable',
    operations: [op],
    requiredSigners: [params.sender],
    options,
  });
}

export interface ClaimParams {
  asset: AssetRef;
  /** The end user claiming the balance — establishes the trustline and is the transaction source. */
  recipient: string;
  /** The account paying the trustline reserve. */
  sponsor: string;
  /** The claimable balance id returned when the balance was created. */
  balanceId: string;
  /** Optional trustline limit. */
  limit?: string;
}

/**
 * Recipient side, unregulated asset: sponsored trustline creation + claim in one transaction.
 *
 *   begin(sponsor) → changeTrust(recipient) → end(recipient) → claim(recipient)
 *
 * Requires signatures from the sponsor and the recipient.
 */
export function buildClaimUnregulated(
  params: ClaimParams,
  recipientAccount: Account,
  network: string,
  options?: BuildOptions,
): BuiltTransaction {
  const operations: PlannedOp[] = [
    ...wrapSponsored([plannedChangeTrust(params.asset, params.recipient, params.limit)], {
      sponsor: params.sponsor,
      sponsored: params.recipient,
    }),
    {
      op: Operation.claimClaimableBalance({
        balanceId: params.balanceId,
        source: params.recipient,
      }),
      type: 'claimClaimableBalance',
      source: params.recipient,
    },
  ];

  return assemble({
    source: recipientAccount,
    network,
    mechanism: 'claimable',
    operations,
    requiredSigners: [params.sponsor, params.recipient],
    options,
  });
}

/**
 * Recipient side, regulated (AUTH_REQUIRED) asset: the same flow plus issuer authorization,
 * because claiming requires an authorized trustline.
 *
 *   begin(sponsor) → changeTrust(recipient) → end(recipient)
 *     → setTrustLineFlags(issuer)   ← inserted before the claim; the approval server signs this
 *     → claim(recipient)
 *
 * Requires signatures from the sponsor, the recipient, and the issuer (via the approval server).
 * The returned {@link BuiltTransaction.issuerAuthOpIndex} points at the issuer operation.
 */
export function buildClaimRegulated(
  params: ClaimParams,
  recipientAccount: Account,
  network: string,
  options?: BuildOptions,
): BuiltTransaction {
  const sponsored = wrapSponsored(
    [plannedChangeTrust(params.asset, params.recipient, params.limit)],
    { sponsor: params.sponsor, sponsored: params.recipient },
  );
  const issuerAuthOpIndex = sponsored.length; // immediately after the sandwich
  const operations: PlannedOp[] = [
    ...sponsored,
    plannedIssuerAuthorize(params.asset, params.recipient),
    {
      op: Operation.claimClaimableBalance({
        balanceId: params.balanceId,
        source: params.recipient,
      }),
      type: 'claimClaimableBalance',
      source: params.recipient,
    },
  ];

  return assemble({
    source: recipientAccount,
    network,
    mechanism: 'claimable',
    operations,
    requiredSigners: [params.sponsor, params.recipient, params.asset.issuer],
    issuerAuthOpIndex,
    options,
  });
}
