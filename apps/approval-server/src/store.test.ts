import { newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';
import { InMemoryStore, type Store } from './store';
import { PostgresStore } from './store.postgres';

// A fixed clock so timestamps are deterministic in assertions.
const clock = () => '2026-01-01T00:00:00.000Z';

function contract(name: string, makeStore: () => Promise<Store>) {
  describe(name, () => {
    it('defaults customer status to unknown, then persists a set value', async () => {
      const store = await makeStore();
      expect(await store.getCustomerStatus('GUSER')).toBe('unknown');
      await store.setCustomerStatus('GUSER', 'approved');
      expect(await store.getCustomerStatus('GUSER')).toBe('approved');
      await store.setCustomerStatus('GUSER', 'denied');
      expect(await store.getCustomerStatus('GUSER')).toBe('denied');
    });

    it('keeps the audit log append-only and ordered', async () => {
      const store = await makeStore();
      await store.appendAudit({ action: 'authorize', actor: 'GISSUER', subject: 'GA' });
      await store.appendAudit({
        action: 'freeze',
        actor: 'GISSUER',
        subject: 'GB',
        reason: 'fraud',
      });
      const log = await store.auditLog();
      expect(log.map((e) => e.action)).toEqual(['authorize', 'freeze']);
      expect(log[1]).toMatchObject({ subject: 'GB', reason: 'fraud', timestamp: clock() });
    });

    it('records authorizations and sponsorships', async () => {
      const store = await makeStore();
      await store.recordAuthorization({ account: 'GA', assetCode: 'EURC', mechanism: 'claimable' });
      await store.recordSponsorship({ account: 'GA', sponsor: 'GSPONSOR', assetCode: 'EURC' });
      expect(await store.listAuthorizations()).toEqual([
        { account: 'GA', assetCode: 'EURC', mechanism: 'claimable', timestamp: clock() },
      ]);
      expect(await store.listSponsorships()).toEqual([
        { account: 'GA', sponsor: 'GSPONSOR', assetCode: 'EURC', timestamp: clock() },
      ]);
    });
  });
}

contract('InMemoryStore', async () => new InMemoryStore(clock));

contract('PostgresStore (pg-mem)', async () => {
  const { Pool } = newDb().adapters.createPg();
  const store = new PostgresStore(new Pool(), clock);
  await store.init();
  return store;
});

describe('PostgresStore durability', () => {
  it('survives a simulated restart (new connection, same database)', async () => {
    const { Pool } = newDb().adapters.createPg();

    // First "process": write state.
    const before = new PostgresStore(new Pool(), clock);
    await before.init();
    await before.setCustomerStatus('GUSER', 'approved');
    await before.appendAudit({ action: 'authorize', actor: 'GISSUER', subject: 'GUSER' });
    await before.recordAuthorization({
      account: 'GUSER',
      assetCode: 'EURC',
      mechanism: 'authorize',
    });

    // Second "process": a fresh store over the same database reads the persisted state. We do
    // not re-run init() here only because pg-mem rejects a repeated CREATE TABLE IF NOT EXISTS;
    // real Postgres treats it as a no-op, which is why init() is safe on every startup.
    const after = new PostgresStore(new Pool(), clock);
    expect(await after.getCustomerStatus('GUSER')).toBe('approved');
    expect(await after.auditLog()).toHaveLength(1);
    expect(await after.listAuthorizations()).toHaveLength(1);
  });
});
