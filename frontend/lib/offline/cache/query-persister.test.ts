import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import { createQueryPersister } from './query-persister';
import { PANTRY_ALL_KEY, keyHash } from './cache-keys';

let db: SqlDb & { close(): void };
let qc: QueryClient;
let userId: string | null;
const count = async () =>
  (await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM cache_entries'))[0].n;
const make = (client = qc) =>
  createQueryPersister({ db, queryClient: client, getUserId: () => userId, writeDelayMs: 150 });

beforeEach(async () => {
  vi.useFakeTimers();
  db = createNodeSqlDb();
  await migrate(db);
  qc = new QueryClient();
  userId = 'u1';
});
afterEach(() => {
  vi.useRealTimers();
  qc.clear();
  db.close();
});

describe('query persister', () => {
  it('writes a whitelisted key after the delay', async () => {
    const p = make();
    p.start();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }]);
    expect(await count()).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    await p.flush();
    expect(await count()).toBe(1);
  });

  it('coalesces rapid updates into one write with the latest data', async () => {
    const p = make();
    p.start();
    const spy = vi.spyOn(db, 'run');
    for (let i = 0; i < 10; i++) qc.setQueryData(PANTRY_ALL_KEY, [{ id: String(i) }]);
    await vi.advanceTimersByTimeAsync(200);
    await p.flush();
    expect(spy.mock.calls.filter((c) => /INSERT/.test(c[0])).length).toBe(1);
    const rows = await db.query<{ state_json: string }>('SELECT state_json FROM cache_entries');
    expect(rows[0].state_json).toContain('"9"');
  });

  it('does not write non-whitelisted keys', async () => {
    const p = make();
    p.start();
    qc.setQueryData(['ai', 'suggest'], { x: 1 });
    await vi.advanceTimersByTimeAsync(200);
    await p.flush();
    expect(await count()).toBe(0);
  });

  it('does not write when no user is known', async () => {
    userId = null;
    const p = make();
    p.start();
    qc.setQueryData(PANTRY_ALL_KEY, []);
    await p.flush();
    expect(await count()).toBe(0);
  });

  it('flush writes pending data immediately', async () => {
    const p = make();
    p.start();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }]);
    await p.flush();
    expect(await count()).toBe(1);
  });

  it('hydrateAll restores data and dataUpdatedAt in a fresh client', async () => {
    const p = make();
    p.start();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }], { updatedAt: 12345 });
    await p.flush();
    const fresh = new QueryClient();
    const res = await make(fresh).hydrateAll();
    expect(res).toEqual({ restored: 1, dropped: 0 });
    expect(fresh.getQueryData(PANTRY_ALL_KEY)).toEqual([{ id: 'a' }]);
    expect(fresh.getQueryState(PANTRY_ALL_KEY)?.dataUpdatedAt).toBe(12345);
    fresh.clear();
  });

  it('ignores rows from another user and hydrates nothing for null user', async () => {
    const p = make();
    p.start();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }]);
    await p.flush();
    const fresh = new QueryClient();
    userId = 'u2';
    expect(await make(fresh).hydrateAll()).toEqual({ restored: 0, dropped: 0 });
    userId = null;
    expect(await make(fresh).hydrateAll()).toEqual({ restored: 0, dropped: 0 });
    expect(fresh.getQueryData(PANTRY_ALL_KEY)).toBeUndefined();
    fresh.clear();
  });

  it('drops corrupt rows and counts them', async () => {
    await db.run(
      'INSERT INTO cache_entries (key_hash,key_json,state_json,user_id,updated_at) VALUES (?,?,?,?,?)',
      [keyHash(PANTRY_ALL_KEY), '["pantry"]', '{not json', 'u1', 1]
    );
    await db.run(
      'INSERT INTO cache_entries (key_hash,key_json,state_json,user_id,updated_at) VALUES (?,?,?,?,?)',
      ['x', '["pantry","x"]', '{"queryKey":"nope"}', 'u1', 1]
    );
    const fresh = new QueryClient();
    expect(await make(fresh).hydrateAll()).toEqual({ restored: 0, dropped: 2 });
    fresh.clear();
  });

  it('keeps rows when queries are removed from memory (only wipe deletes rows)', async () => {
    const p = make();
    p.start();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }]);
    await p.flush();
    p.suspend();
    qc.clear();
    await p.flush();
    expect(await count()).toBe(1);
    p.resume();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }]);
    await p.flush();
    qc.clear();
    await p.flush();
    expect(await count()).toBe(1);
  });

  it('a GC removal in a session that never hydrated keeps the persisted row (CR-05)', async () => {
    const p = make();
    p.start();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }]);
    await p.flush();
    const query = qc.getQueryCache().find({ queryKey: [...PANTRY_ALL_KEY], exact: true });
    qc.getQueryCache().remove(query!);
    await p.flush();
    expect(await count()).toBe(1);
  });

  it('defers writes while suspended and performs them on resume', async () => {
    const p = make();
    p.start();
    p.suspend();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }]);
    await p.flush();
    expect(await count()).toBe(0);
    p.resume();
    await p.flush();
    expect(await count()).toBe(1);
  });

  it('start() sets infinite gcTime for persisted prefixes without hydrateAll (CR-05)', () => {
    const p = make();
    expect(qc.getQueryDefaults([...PANTRY_ALL_KEY]).gcTime).toBeUndefined();
    p.start();
    expect(qc.getQueryDefaults([...PANTRY_ALL_KEY]).gcTime).toBe(Infinity);
    expect(qc.getQueryDefaults(['shopping', 'active']).gcTime).toBe(Infinity);
  });

  it('wipe deletes cache rows and stop unsubscribes', async () => {
    const p = make();
    const stop = p.start();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }]);
    await p.flush();
    await p.wipe();
    expect(await count()).toBe(0);
    stop();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'b' }]);
    await p.flush();
    expect(await count()).toBe(0);
  });

  it('skips the write while canPersist is false and writes once it is true', async () => {
    let allowed = false;
    const p = createQueryPersister({
      db,
      queryClient: qc,
      getUserId: () => userId,
      writeDelayMs: 150,
      canPersist: async () => allowed,
    });
    p.start();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'a' }]);
    await vi.advanceTimersByTimeAsync(200);
    await p.flush();
    expect(await count()).toBe(0);
    allowed = true;
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'b' }]);
    await vi.advanceTimersByTimeAsync(200);
    await p.flush();
    expect(await count()).toBe(1);
  });

  it('persists the state read before canPersist, never an optimistic write that lands during the check (WR-05)', async () => {
    const p = createQueryPersister({
      db,
      queryClient: qc,
      getUserId: () => userId,
      writeDelayMs: 150,
      canPersist: async () => {
        qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'optimistic' }]);
        return true;
      },
    });
    p.start();
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: 'server' }]);
    await vi.advanceTimersByTimeAsync(200);
    const rows = await db.query<{ state_json: string }>('SELECT state_json FROM cache_entries');
    expect(rows[0].state_json).toContain('"server"');
    expect(rows[0].state_json).not.toContain('"optimistic"');
  });
});
