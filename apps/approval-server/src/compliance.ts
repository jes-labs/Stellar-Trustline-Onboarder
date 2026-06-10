/**
 * Compliance and audit (stub).
 *
 * The reference implementation models the issuer's compliance decision and the append-only audit
 * trail required by the regulated profile. KYC itself is delegated to the issuer (SEP-12 hooks in
 * a later phase); here an account is approved unless explicitly denied.
 */

export type AuditAction = 'authorize' | 'freeze' | 'clawback';

export interface AuditEntry {
  action: AuditAction;
  /** The party responsible for the action (the issuer). */
  actor: string;
  /** The account the action targets. */
  subject: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  reason?: string;
}

export class Compliance {
  private readonly denied = new Set<string>();
  private readonly entries: AuditEntry[] = [];

  /** Whether an account is cleared to receive an authorized trustline. */
  isApproved(account: string): boolean {
    return !this.denied.has(account);
  }

  /** Mark an account as not-yet-approved (e.g. KYC incomplete). */
  deny(account: string): void {
    this.denied.add(account);
  }

  /** Clear a denial. */
  approve(account: string): void {
    this.denied.delete(account);
  }

  /** Append an audit entry. */
  record(entry: Omit<AuditEntry, 'timestamp'>): void {
    this.entries.push({ ...entry, timestamp: new Date().toISOString() });
  }

  /** A snapshot of the append-only audit log. */
  audit(): AuditEntry[] {
    return [...this.entries];
  }
}
