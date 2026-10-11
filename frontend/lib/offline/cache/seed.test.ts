import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import { applySnapshot } from './seed';
import { readCacheMeta } from './cache-meta';
import {
  PANTRY_ALL_KEY,
  RECIPES_ALL_KEY,
  MEAL_PLANS_ALL_KEY,
  SHOPPING_ACTIVE_KEY,
} from './cache-keys';
import { COOK_PANTRY_KEY, COOK_RECIPES_KEY } from '@/lib/hooks/use-cook-from-pantry';
import type { BootstrapSnapshot } from './bootstrap-client';

let db: SqlDb & { close(): void };
let qc: QueryClient;
beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  qc = new QueryClient();
});
afterEach(() => {
  qc.clear();
  db.close();
});

const snap = (over: Partial<BootstrapSnapshot> = {}): BootstrapSnapshot =>
  ({
    serverTime: '2026-02-02T00:00:00Z',
    pantry: [{ id: 'p', quantity: '2.5' }],
    recipes: [{ id: 'r' }],
    mealPlans: [{ id: 'm' }],
    shoppingList: { id: 's', items: [] },
    ...over,
  }) as unknown as BootstrapSnapshot;

describe('applySnapshot', () => {
  it('writes canonical keys, cook aliases, normalized quantities and meta', async () => {
    const reapply = vi.fn((_k: readonly unknown[], d: unknown) => d);
    await applySnapshot({ queryClient: qc, snapshot: snap(), db, reapply });
    expect(qc.getQueryData(PANTRY_ALL_KEY)).toEqual([{ id: 'p', quantity: 2.5 }]);
    // Cook keys must match useCookFromPantry's { items, capped } shape (11-REVIEW-FIX follow-up).
    expect(qc.getQueryData(COOK_PANTRY_KEY)).toEqual({ items: [{ id: 'p', quantity: 2.5 }], capped: false });
    expect(qc.getQueryData(RECIPES_ALL_KEY)).toEqual([{ id: 'r' }]);
    expect(qc.getQueryData(COOK_RECIPES_KEY)).toEqual({ items: [{ id: 'r' }], capped: false });
    expect(qc.getQueryData(MEAL_PLANS_ALL_KEY)).toEqual([{ id: 'm' }]);
    expect(qc.getQueryData(SHOPPING_ACTIVE_KEY)).toEqual({ id: 's', items: [] });
    expect((await readCacheMeta(db)).lastBootstrapAt).toBe('2026-02-02T00:00:00Z');
  });

  it('calls reapply per key and stores its result', async () => {
    const reapply = vi.fn((k: readonly unknown[], d: unknown) => (k === RECIPES_ALL_KEY ? [] : d));
    await applySnapshot({ queryClient: qc, snapshot: snap(), db, reapply });
    expect(reapply).toHaveBeenCalledTimes(6);
    expect(qc.getQueryData(RECIPES_ALL_KEY)).toEqual([]);
  });

  it('skips the shopping key when snapshot has no list', async () => {
    await applySnapshot({ queryClient: qc, snapshot: snap({ shoppingList: null }), db, reapply: (_k, d) => d });
    expect(qc.getQueryData(SHOPPING_ACTIVE_KEY)).toBeUndefined();
  });
});
