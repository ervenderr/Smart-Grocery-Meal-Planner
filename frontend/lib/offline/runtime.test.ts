import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createNodeSqlDb } from './sql/node-sqldb.test-helper';
import { migrate } from './sql/migrations';
import type { SqlDb } from './sql/types';
import { createOfflineRuntime, getOfflineRuntime, setOfflineRuntime, type OfflineRuntime } from './runtime';
import { PANTRY_ALL_KEY, SHOPPING_ACTIVE_KEY } from './cache/cache-keys';
import { ID_A, ID_B } from './outbox/fixtures.test-helper';
import type { DrainEvent } from './outbox/drain';

let db: SqlDb & { close(): void };
let qc: QueryClient;
let rt: OfflineRuntime;
let online: boolean;
let userId: string | null;
const post = vi.fn();
const client = { post, patch: vi.fn(), delete: vi.fn() };

const page = (over: Record<string, unknown>) => ({
  serverTime: '2026-02-02T00:00:00Z',
  section: 'pantry',
  items: [],
  nextCursor: null,
  ...over,
});

function make(fetchPage: (c: string | null) => Promise<unknown>) {
  rt = createOfflineRuntime({
    db,
    queryClient: qc,
    getUserId: () => userId,
    transportClient: client as never,
    probe: async () => online,
    fetchPage,
  });
  return rt;
}

const adjust = { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 } } as const;

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  qc = new QueryClient();
  online = true;
  userId = 'u1';
  post.mockReset();
});
afterEach(() => {
  rt?.dispose();
  setOfflineRuntime(null);
  qc.clear();
  db.close();
});

describe('offline runtime', () => {
  it('enqueue without a user throws', async () => {
    make(async () => page({}));
    userId = null;
    await expect(rt.enqueue(adjust)).rejects.toThrow();
  });

  it('enqueue persists and kicks the drain once', async () => {
    make(async () => page({}));
    const kick = vi.spyOn(rt.drain, 'kick');
    online = false;
    const row = await rt.enqueue(adjust);
    expect(row?.kind).toBe('pantry.adjust');
    expect(kick).toHaveBeenCalledTimes(1);
    expect(await rt.store.list('u1')).toHaveLength(1);
  });

  it('applied event patches the pantry cache with the server quantity', async () => {
    make(async () => page({}));
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: ID_A, quantity: 5 }]);
    post.mockResolvedValue({ id: ID_A, quantity: '7' });
    const events: DrainEvent[] = [];
    rt.onEvent((e) => events.push(e));
    await rt.enqueue(adjust);
    await rt.drain.whenIdle();
    expect(events.some((e) => e.type === 'applied')).toBe(true);
    expect((qc.getQueryData(PANTRY_ALL_KEY) as { quantity: number }[])[0].quantity).toBe(7);
  });

  it('parked event leaves the optimistic cache untouched', async () => {
    make(async () => page({}));
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: ID_A, quantity: 7 }]);
    post.mockRejectedValue({ response: { status: 404 } });
    const events: DrainEvent[] = [];
    rt.onEvent((e) => events.push(e));
    await rt.enqueue(adjust);
    await rt.drain.whenIdle();
    expect(events.some((e) => e.type === 'parked')).toBe(true);
    expect((qc.getQueryData(PANTRY_ALL_KEY) as { quantity: number }[])[0].quantity).toBe(7);
  });

  it('refreshFromServer offline returns offline without fetching', async () => {
    const fetchPage = vi.fn(async () => page({}));
    make(fetchPage);
    online = false;
    expect(await rt.refreshFromServer('t')).toBe('offline');
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('refreshFromServer without a user is skipped', async () => {
    make(async () => page({}));
    userId = null;
    expect(await rt.refreshFromServer('t')).toBe('skipped');
  });

  it('refreshFromServer returns error on an invalid page', async () => {
    make(async () => ({ nope: true }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await rt.refreshFromServer('t')).toBe('error');
    spy.mockRestore();
  });

  it('refresh writes canonical keys and re-applies a pending shopping create', async () => {
    const pages = new Map<string | null, unknown>([
      [null, page({ section: 'pantry', items: [{ id: 'p1', quantity: '1' }], nextCursor: 'c1', shoppingList: { id: 's', items: [] } })],
      ['c1', page({ section: 'recipes', items: [{ id: 'r1' }], nextCursor: null })],
    ]);
    make(async (c) => pages.get(c));
    post.mockReturnValue(new Promise(() => {})); // op stays pending
    await rt.enqueue({
      kind: 'shopping.item.create',
      label: 'Milk',
      payload: { item: { id: ID_B, itemName: 'Milk', quantity: 1 } },
    } as never);
    expect(await rt.refreshFromServer('t')).toBe('ok');
    const list = qc.getQueryData(SHOPPING_ACTIVE_KEY) as { items: { id: string }[] };
    expect(list.items.map((i) => i.id)).toContain(ID_B);
    expect(qc.getQueryData(PANTRY_ALL_KEY)).toEqual([{ id: 'p1', quantity: 1 }]);
  });

  it('two concurrent refreshes fetch once', async () => {
    const fetchPage = vi.fn(async () => page({}));
    make(fetchPage);
    const [a, b] = await Promise.all([rt.refreshFromServer('a'), rt.refreshFromServer('b')]);
    expect([a, b]).toEqual(['ok', 'ok']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('registerExecutors adds a kind the drain can execute', async () => {
    make(async () => page({}));
    const run = vi.fn().mockResolvedValue({ done: true });
    rt.registerExecutors({ 'cook.apply': { run } });
    const events: DrainEvent[] = [];
    rt.onEvent((e) => events.push(e));
    await rt.enqueue({
      kind: 'cook.apply',
      label: 'Cook',
      payload: { target: { recipeId: ID_A }, servings: 2, occurredAt: '2026-02-02T00:00:00.000Z' },
    } as never);
    await rt.drain.whenIdle();
    expect(run).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.type === 'applied')).toBe(true);
  });

  it('finished with applied ops and an empty queue triggers a drained refresh', async () => {
    const fetchPage = vi.fn(async () => page({}));
    make(fetchPage);
    post.mockResolvedValue({ id: ID_A, quantity: 7 });
    await rt.enqueue(adjust);
    await rt.drain.whenIdle();
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('unsubscribing a listener stops events; singleton holder round-trips', async () => {
    make(async () => page({}));
    const l = vi.fn();
    const off = rt.onEvent(l);
    off();
    post.mockResolvedValue({ id: ID_A, quantity: 7 });
    await rt.enqueue(adjust);
    await rt.drain.whenIdle();
    expect(l).not.toHaveBeenCalled();
    setOfflineRuntime(rt);
    expect(getOfflineRuntime()).toBe(rt);
  });
});
