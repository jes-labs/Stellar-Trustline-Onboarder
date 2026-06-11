/**
 * Persistence for the regulated profile. The approval server reads and writes everything the
 * MiCA story requires through this interface, so the backing store is swappable: an in-memory
 * store for development and tests, Postgres in production (see store.postgres.ts).
 */

/** KYC state of a holder. `unknown` is the fail-closed default for an account we have not seen. */
export type KycStatus = 'unknown' | 'pending' | 'approved' | 'denied';

export type AuditAction = 'authorize' | 'freeze' | 'clawback';

export interface AuditEntry {
  action: AuditAction;
  /** The party responsible (the issuer). */
  actor: string;
  /** The account the action targets. */
  subject: string;
  reason?: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

export interface AuthorizationRecord {
  account: string;
  assetCode: string;
  mechanism: string;
  timestamp: string;
}

export interface SponsorshipRecord {
  account: string;
  sponsor: string;
  assetCode: string;
  timestamp: string;
}

export interface Store {
  /** KYC status for an account; `unknown` when the account has no record. */
  getCustomerStatus(account: string): Promise<KycStatus>;
  setCustomerStatus(account: string, status: KycStatus): Promise<void>;

  recordAuthorization(record: Omit<AuthorizationRecord, 'timestamp'>): Promise<void>;
  listAuthorizations(): Promise<AuthorizationRecord[]>;

  /** Append to the audit log. The log is append-only. */
  appendAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void>;
  auditLog(): Promise<AuditEntry[]>;

  recordSponsorship(record: Omit<SponsorshipRecord, 'timestamp'>): Promise<void>;
  listSponsorships(): Promise<SponsorshipRecord[]>;

  /** Release any held resources (no-op for the in-memory store). */
  close(): Promise<void>;
}

/** Development and test store. State lives in memory and does not survive a restart. */
export class InMemoryStore implements Store {
  private readonly customers = new Map<string, KycStatus>();
  private readonly authorizations: AuthorizationRecord[] = [];
  private readonly audit: AuditEntry[] = [];
  private readonly sponsorships: SponsorshipRecord[] = [];
  private readonly clock: () => string;

  constructor(clock: () => string = () => new Date().toISOString()) {
    this.clock = clock;
  }

  async getCustomerStatus(account: string): Promise<KycStatus> {
    return this.customers.get(account) ?? 'unknown';
  }

  async setCustomerStatus(account: string, status: KycStatus): Promise<void> {
    this.customers.set(account, status);
  }

  async recordAuthorization(record: Omit<AuthorizationRecord, 'timestamp'>): Promise<void> {
    this.authorizations.push({ ...record, timestamp: this.clock() });
  }

  async listAuthorizations(): Promise<AuthorizationRecord[]> {
    return [...this.authorizations];
  }

  async appendAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    this.audit.push({ ...entry, timestamp: this.clock() });
  }

  async auditLog(): Promise<AuditEntry[]> {
    return [...this.audit];
  }

  async recordSponsorship(record: Omit<SponsorshipRecord, 'timestamp'>): Promise<void> {
    this.sponsorships.push({ ...record, timestamp: this.clock() });
  }

  async listSponsorships(): Promise<SponsorshipRecord[]> {
    return [...this.sponsorships];
  }

  async close(): Promise<void> {
    // nothing to release
  }
}
