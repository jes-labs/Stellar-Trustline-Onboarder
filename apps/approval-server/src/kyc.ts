import type { KycStatus, Store } from './store';

/**
 * The KYC check the approval server calls before authorizing a holder. Implement this against a
 * real SEP-12 provider in production. The contract is fail-closed: anything other than an
 * explicit `approved` must not result in authorization.
 */
export interface KYCProvider {
  status(account: string): Promise<KycStatus>;
}

/**
 * Default provider, backed by the store's customer records. An account with no record reads as
 * `unknown` (never approved by default). An operator records a decision with
 * {@link Store.setCustomerStatus}; a real deployment swaps this for a SEP-12-backed provider.
 */
export class StoreKycProvider implements KYCProvider {
  constructor(private readonly store: Store) {}

  status(account: string): Promise<KycStatus> {
    return this.store.getCustomerStatus(account);
  }
}

export type KycDecision = 'approved' | 'action_required' | 'rejected';

/**
 * Map a KYC status to an approval decision. Fail-closed: only an explicit `approved` proceeds;
 * `denied` is rejected; everything else (`pending`, `unknown`) asks the user to complete KYC.
 */
export function decide(status: KycStatus): KycDecision {
  if (status === 'approved') return 'approved';
  if (status === 'denied') return 'rejected';
  return 'action_required';
}
