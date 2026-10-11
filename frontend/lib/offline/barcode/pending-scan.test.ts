import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../sql/migrations';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import type { SqlDb } from '../sql/types';
import { createPendingScans } from './pending-scan';

let db: SqlDb & { close(): void };
beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
});
afterEach(() => db.close());

describe('pending scans', () => {
  it('lists unresolved scans per user', async () => {
    const p = createPendingScans({ db, now: () => 1 });
    await p.add('u1', 'item1', '123');
    expect(await p.listUnresolved('u1')).toEqual([{ pantryItemId: 'item1', barcode: '123', attempts: 0 }]);
    expect(await p.listUnresolved('u2')).toEqual([]);
  });

  it('hides resolved scans', async () => {
    const p = createPendingScans({ db });
    await p.add('u1', 'item1', '123');
    await p.markResolved('item1');
    expect(await p.listUnresolved('u1')).toEqual([]);
  });

  it('stops after 5 attempts', async () => {
    const p = createPendingScans({ db });
    await p.add('u1', 'item1', '123');
    for (let i = 0; i < 4; i += 1) await p.bumpAttempts('item1');
    expect(await p.listUnresolved('u1')).toHaveLength(1);
    await p.bumpAttempts('item1');
    expect(await p.listUnresolved('u1')).toEqual([]);
  });

  it('re-adding a scan resets it for the same item', async () => {
    const p = createPendingScans({ db });
    await p.add('u1', 'item1', '123');
    await p.markResolved('item1');
    await p.add('u1', 'item1', '456');
    expect(await p.listUnresolved('u1')).toEqual([{ pantryItemId: 'item1', barcode: '456', attempts: 0 }]);
  });
});
