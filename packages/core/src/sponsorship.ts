import { Operation } from '@stellar/stellar-sdk';
import type { PlannedOp } from './tx';

/**
 * Wrap a list of operations in the sponsored-reserve "sandwich" so the sponsored account
 * needs no XLM for the reserves created inside.
 *
 *   beginSponsoringFutureReserves   (source: sponsor)
 *   ...inner ops...
 *   endSponsoringFutureReserves     (source: sponsored)
 *
 * The `begin` op is sourced by the sponsor (who pays); the `end` op must be sourced by the
 * sponsored account itself, per protocol. Both the sponsor and the sponsored account therefore
 * need to sign the resulting transaction.
 */
export function wrapSponsored(
  inner: PlannedOp[],
  params: { sponsor: string; sponsored: string },
): PlannedOp[] {
  return [
    {
      op: Operation.beginSponsoringFutureReserves({
        sponsoredId: params.sponsored,
        source: params.sponsor,
      }),
      type: 'beginSponsoringFutureReserves',
      source: params.sponsor,
    },
    ...inner,
    {
      op: Operation.endSponsoringFutureReserves({ source: params.sponsored }),
      type: 'endSponsoringFutureReserves',
      source: params.sponsored,
    },
  ];
}
