import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FoodAttribution, FoodProduct } from '@/lib/api/food';
import { migrate } from '../sql/migrations';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import type { SqlDb } from '../sql/types';
import { BARCODE_CACHE_CAP, NEGATIVE_TTL_MS, createBarcodeCache } from './barcode-cache';

const attribution: FoodAttribution = { name: 'OFF', url: 'u', license: 'l', note: 'n' };
const product: FoodProduct = {
  barcode: '4800016644801',
  name: 'Milk',
  brand: 'Acme',
  quantity: '1 l',
  imageUrl: null,
  suggestedCategory: 'dairy',
  nutritionPer100g: { energyKcal: 1, protein: 1, fat: 1, carbs: 1 },
};

let db: SqlDb & { close(): void };
let clock = 1000;
const cache = () => createBarcodeCache({ db, now: () => clock });

beforeEach(async () => {
  clock = 1000;
  db = createNodeSqlDb();
  await migrate(db);
});
afterEach(() => db.close());

describe('barcode cache', () => {
  it('returns a stored product and scopes by user', async () => {
    const c = cache();
    await c.putFound('u1', '4800016644801', product, attribution);
    expect(await c.get('u1', '4800016644801')).toEqual({ found: true, product, attribution });
    expect(await c.get('u2', '4800016644801')).toBeNull();
  });

  it('honors a negative entry for 7 days only', async () => {
    const c = cache();
    await c.putNotFound('u1', '123');
    expect(await c.get('u1', '123')).toEqual({ found: false });
    clock += NEGATIVE_TTL_MS + 1;
    expect(await c.get('u1', '123')).toBeNull();
  });

  it('treats corrupt product_json as a miss', async () => {
    const c = cache();
    await c.putFound('u1', '1', product, attribution);
    await db.run(`UPDATE barcode_cache SET product_json = ? WHERE user_id = ?`, ['{"bad":1}', 'u1']);
    expect(await c.get('u1', '1')).toBeNull();
    await db.run(`UPDATE barcode_cache SET product_json = ? WHERE user_id = ?`, ['not json', 'u1']);
    expect(await c.get('u1', '1')).toBeNull();
  });

  it('prunes to the most recently used entries', async () => {
    const c = cache();
    for (let i = 0; i < BARCODE_CACHE_CAP + 3; i += 1) {
      clock += 1;
      await c.putFound('u1', `code${i}`, product, attribution);
    }
    await c.prune('u1');
    const rows = await db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM barcode_cache WHERE user_id = ?`,
      ['u1']
    );
    expect(rows[0].n).toBe(BARCODE_CACHE_CAP);
    expect(await c.get('u1', 'code0')).toBeNull();
    expect(await c.get('u1', `code${BARCODE_CACHE_CAP + 2}`)).not.toBeNull();
  });

  it('get refreshes last_used_at', async () => {
    const c = cache();
    await c.putFound('u1', '1', product, attribution);
    clock = 5000;
    await c.get('u1', '1');
    const rows = await db.query<{ last_used_at: number }>(
      `SELECT last_used_at FROM barcode_cache WHERE user_id = ?`,
      ['u1']
    );
    expect(rows[0].last_used_at).toBe(5000);
  });
});
