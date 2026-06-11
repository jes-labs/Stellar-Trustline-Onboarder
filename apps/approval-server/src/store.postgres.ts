import type { Pool } from 'pg';
import type { AuditEntry, AuthorizationRecord, KycStatus, SponsorshipRecord, Store } from './store';

const SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS customers (
    account TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS authorizations (
    id SERIAL PRIMARY KEY,
    account TEXT NOT NULL,
    asset_code TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    subject TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sponsorships (
    id SERIAL PRIMARY KEY,
    account TEXT NOT NULL,
    sponsor TEXT NOT NULL,
    asset_code TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
];

/**
 * Postgres-backed {@link Store}. The audit log is append-only: this class only ever inserts into
 * and selects from `audit_log`, never updates or deletes. Timestamps are generated here as ISO
 * strings so the format is stable across backends.
 */
export class PostgresStore implements Store {
  private readonly pool: Pool;
  private readonly clock: () => string;

  constructor(pool: Pool, clock: () => string = () => new Date().toISOString()) {
    this.pool = pool;
    this.clock = clock;
  }

  /** Create the schema if it does not exist. Safe to call on every startup. */
  async init(): Promise<void> {
    for (const statement of SCHEMA) {
      await this.pool.query(statement);
    }
  }

  async getCustomerStatus(account: string): Promise<KycStatus> {
    const res = await this.pool.query('SELECT status FROM customers WHERE account = $1', [account]);
    return (res.rows[0]?.status as KycStatus) ?? 'unknown';
  }

  async setCustomerStatus(account: string, status: KycStatus): Promise<void> {
    await this.pool.query(
      `INSERT INTO customers (account, status, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (account) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
      [account, status, this.clock()],
    );
  }

  async recordAuthorization(record: Omit<AuthorizationRecord, 'timestamp'>): Promise<void> {
    await this.pool.query(
      'INSERT INTO authorizations (account, asset_code, mechanism, created_at) VALUES ($1, $2, $3, $4)',
      [record.account, record.assetCode, record.mechanism, this.clock()],
    );
  }

  async listAuthorizations(): Promise<AuthorizationRecord[]> {
    const res = await this.pool.query(
      'SELECT account, asset_code, mechanism, created_at FROM authorizations ORDER BY id ASC',
    );
    return res.rows.map((r) => ({
      account: r.account,
      assetCode: r.asset_code,
      mechanism: r.mechanism,
      timestamp: r.created_at,
    }));
  }

  async appendAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    await this.pool.query(
      'INSERT INTO audit_log (action, actor, subject, reason, created_at) VALUES ($1, $2, $3, $4, $5)',
      [entry.action, entry.actor, entry.subject, entry.reason ?? null, this.clock()],
    );
  }

  async auditLog(): Promise<AuditEntry[]> {
    const res = await this.pool.query(
      'SELECT action, actor, subject, reason, created_at FROM audit_log ORDER BY id ASC',
    );
    return res.rows.map((r) => ({
      action: r.action,
      actor: r.actor,
      subject: r.subject,
      reason: r.reason ?? undefined,
      timestamp: r.created_at,
    }));
  }

  async recordSponsorship(record: Omit<SponsorshipRecord, 'timestamp'>): Promise<void> {
    await this.pool.query(
      'INSERT INTO sponsorships (account, sponsor, asset_code, created_at) VALUES ($1, $2, $3, $4)',
      [record.account, record.sponsor, record.assetCode, this.clock()],
    );
  }

  async listSponsorships(): Promise<SponsorshipRecord[]> {
    const res = await this.pool.query(
      'SELECT account, sponsor, asset_code, created_at FROM sponsorships ORDER BY id ASC',
    );
    return res.rows.map((r) => ({
      account: r.account,
      sponsor: r.sponsor,
      assetCode: r.asset_code,
      timestamp: r.created_at,
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
