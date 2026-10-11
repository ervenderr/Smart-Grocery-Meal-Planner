import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodAttribution, FoodProduct } from '@/lib/api/food';
import { resolveBarcode } from '@/lib/scan/resolve-barcode';
import type { PantryItem } from '@/types/pantry.types';
import { migrate } from '../sql/migrations';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import type { SqlDb } from '../sql/types';
import { createBarcodeCache } from './barcode-cache';
import { createScanDeps } from './scan-deps';

const attribution: FoodAttribution = { name: 'OFF', url: 'u', license: 'l', note: 'n' };
const product: FoodProduct = {
  barcode: '4800016644801', name: 'Milk', brand: 'Acme', quantity: null, imageUrl: null,
  suggestedCategory: 'dairy',
  nutritionPer100g: { energyKcal: null, protein: null, fat: null, carbs: null },
};
const ownItem = { id: 'p1', ingredientName: 'Rice', barcode: '0123456789012' } as PantryItem;
const CODE = '4800016644801';

let db: SqlDb & { close(): void };
beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
});
afterEach(() => db.close());

function deps(over: { online?: boolean; onlineLookup?: () => Promise<never> | Promise<{ product: FoodProduct; attribution: FoodAttribution }>; items?: PantryItem[] } = {}) {
  const cache = createBarcodeCache({ db });
  const onlineLookup = vi.fn(over.onlineLookup ?? (async () => ({ product, attribution })));
  return {
    cache,
    onlineLookup,
    deps: createScanDeps({
      userId: 'u1',
      getPantryItems: () => over.items ?? [ownItem],
      cache,
      isOnline: () => over.online ?? true,
      onlineLookup,
    }),
  };
}

describe('createScanDeps', () => {
  it('finds an own item offline by normalized barcode', async () => {
    const { deps: d } = deps({ online: false });
    const r = await resolveBarcode('123456789012', d);
    expect(r.kind).toBe('own');
  });

  it('returns a cached product offline', async () => {
    const { deps: d, cache } = deps({ online: false });
    await cache.putFound('u1', CODE, product, attribution);
    expect((await resolveBarcode(CODE, d)).kind).toBe('found');
  });

  it('turns a cached negative into unknown', async () => {
    const { deps: d, cache, onlineLookup } = deps({ online: true });
    await cache.putNotFound('u1', CODE);
    expect((await resolveBarcode(CODE, d)).kind).toBe('unknown');
    expect(onlineLookup).not.toHaveBeenCalled();
  });

  it('yields offline-unknown on an offline cache miss', async () => {
    const { deps: d } = deps({ online: false });
    expect((await resolveBarcode(CODE, d)).kind).toBe('offline-unknown');
  });

  it('stores an online result', async () => {
    const { deps: d, cache, onlineLookup } = deps();
    expect((await resolveBarcode(CODE, d)).kind).toBe('found');
    expect(onlineLookup).toHaveBeenCalledTimes(1);
    expect(await cache.get('u1', CODE)).toMatchObject({ found: true });
  });

  it('stores a negative on LOOKUP_NOT_FOUND', async () => {
    const { deps: d, cache } = deps({
      onlineLookup: () => Promise.reject({ response: { data: { code: 'LOOKUP_NOT_FOUND' } } }),
    });
    expect((await resolveBarcode(CODE, d)).kind).toBe('unknown');
    expect(await cache.get('u1', CODE)).toEqual({ found: false });
  });

  it('does not cache other failures', async () => {
    const { deps: d, cache } = deps({ onlineLookup: () => Promise.reject(new Error('boom')) });
    expect((await resolveBarcode(CODE, d)).kind).toBe('failed');
    expect(await cache.get('u1', CODE)).toBeNull();
  });
});
