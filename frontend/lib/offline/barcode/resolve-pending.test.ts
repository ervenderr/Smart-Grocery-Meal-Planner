import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodAttribution, FoodProduct } from '@/lib/api/food';
import type { PantryItem } from '@/types/pantry.types';
import { migrate } from '../sql/migrations';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import type { SqlDb } from '../sql/types';
import { createBarcodeCache } from './barcode-cache';
import { createPendingScans } from './pending-scan';
import { fillBlanksPatch, resolvePendingScans } from './resolve-pending';

const attribution: FoodAttribution = { name: 'OFF', url: 'u', license: 'l', note: 'n' };
const product: FoodProduct = {
  barcode: '4800016644801', name: 'Official Milk', brand: 'Acme', quantity: '1 l', imageUrl: null,
  suggestedCategory: 'dairy',
  nutritionPer100g: { energyKcal: null, protein: null, fat: null, carbs: null },
};
const item = (over: Partial<PantryItem> = {}): PantryItem =>
  ({ id: 'p1', ingredientName: 'My milk', category: 'other', quantity: 3, unit: 'pieces', notes: null, barcode: '4800016644801', ...over }) as PantryItem;

describe('fillBlanksPatch', () => {
  it('fills blank notes and default category, never name or quantity', () => {
    expect(fillBlanksPatch(item(), product, '4800016644801')).toEqual({ notes: 'Acme', category: 'dairy' });
  });
  it('keeps user-entered values', () => {
    expect(fillBlanksPatch(item({ notes: 'mine', category: 'beverages' }), product, '4800016644801')).toEqual({});
  });
  it('adds the barcode only when missing', () => {
    expect(fillBlanksPatch(item({ barcode: null, notes: 'x', category: 'fruit' }), product, '4800016644801')).toEqual({ barcode: '4800016644801' });
  });
});

let db: SqlDb & { close(): void };
beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
});
afterEach(() => db.close());

async function run(over: { lookup?: () => Promise<{ product: FoodProduct; attribution: FoodAttribution }>; createPending?: boolean; item?: PantryItem | undefined } = {}) {
  const pending = createPendingScans({ db });
  const cache = createBarcodeCache({ db });
  await pending.add('u1', 'p1', '4800016644801');
  const enqueue = vi.fn(async (_op: unknown) => null);
  const result = await resolvePendingScans({
    pending,
    list: await pending.listUnresolved('u1'),
    cache,
    userId: 'u1',
    lookup: over.lookup ?? (async () => ({ product, attribution })),
    getItem: () => ('item' in over ? over.item : item()),
    isCreatePending: () => over.createPending ?? false,
    enqueue,
  });
  return { result, enqueue, pending, cache };
}

describe('resolvePendingScans', () => {
  it('skips items whose create is still queued', async () => {
    const { result, enqueue, pending } = await run({ createPending: true });
    expect(result).toEqual({ resolved: 0, filled: 0 });
    expect(enqueue).not.toHaveBeenCalled();
    expect(await pending.listUnresolved('u1')).toHaveLength(1);
  });

  it('enqueues one update and resolves on found', async () => {
    const { result, enqueue, pending, cache } = await run();
    expect(result).toEqual({ resolved: 1, filled: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toMatchObject({ kind: 'pantry.update', payload: { id: 'p1', patch: { notes: 'Acme', category: 'dairy' } } });
    expect(await pending.listUnresolved('u1')).toEqual([]);
    expect(await cache.get('u1', '4800016644801')).toMatchObject({ found: true });
  });

  it('resolves without ops when nothing is blank', async () => {
    const { result, enqueue } = await run({ item: item({ notes: 'n', category: 'fruit' }) });
    expect(result).toEqual({ resolved: 1, filled: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('resolves on not found and caches the negative', async () => {
    const { result, enqueue, cache } = await run({
      lookup: () => Promise.reject({ response: { data: { code: 'LOOKUP_NOT_FOUND' } } }),
    });
    expect(result.resolved).toBe(1);
    expect(enqueue).not.toHaveBeenCalled();
    expect(await cache.get('u1', '4800016644801')).toEqual({ found: false });
  });

  it('bumps attempts on a network failure', async () => {
    const { result, pending } = await run({ lookup: () => Promise.reject(new Error('net')) });
    expect(result.resolved).toBe(0);
    expect((await pending.listUnresolved('u1'))[0].attempts).toBe(1);
  });

  it('resolves a scan whose item was deleted', async () => {
    const { result, pending } = await run({ item: undefined });
    expect(result.resolved).toBe(1);
    expect(await pending.listUnresolved('u1')).toEqual([]);
  });
});
