import { z } from 'zod';
import type { FoodAttribution, FoodProduct } from '@/lib/api/food';
import type { SqlDb } from '../sql/types';

export const NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const BARCODE_CACHE_CAP = 500;

const nutrient = z.number().nullable();
const productSchema = z.object({
  barcode: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  quantity: z.string().nullable(),
  imageUrl: z.string().nullable(),
  suggestedCategory: z.enum([
    'protein', 'vegetable', 'fruit', 'dairy', 'grains', 'spices',
    'canned', 'frozen', 'beverages', 'condiments', 'other',
  ]),
  nutritionPer100g: z.object({
    energyKcal: nutrient, protein: nutrient, fat: nutrient, carbs: nutrient,
  }),
});
const storedSchema = z.object({
  product: productSchema,
  attribution: z.object({ name: z.string(), url: z.string(), license: z.string(), note: z.string() }),
});

export type BarcodeCacheEntry =
  | { found: true; product: FoodProduct; attribution: FoodAttribution }
  | { found: false };

interface Row {
  found: number;
  product_json: string | null;
  fetched_at: number;
}

export interface BarcodeCache {
  get(userId: string, code: string): Promise<BarcodeCacheEntry | null>;
  putFound(userId: string, code: string, product: FoodProduct, attribution: FoodAttribution): Promise<void>;
  putNotFound(userId: string, code: string): Promise<void>;
  prune(userId: string): Promise<void>;
}

function parseStored(json: string | null): BarcodeCacheEntry | null {
  if (!json) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(json));
    return parsed.success ? { found: true, ...parsed.data } : null;
  } catch {
    return null;
  }
}

export function createBarcodeCache(args: { db: SqlDb; now?: () => number }): BarcodeCache {
  const { db } = args;
  const now = args.now ?? Date.now;

  const put = async (userId: string, code: string, found: number, json: string | null) => {
    const t = now();
    await db.run(
      `INSERT OR REPLACE INTO barcode_cache (barcode, user_id, found, product_json, fetched_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code, userId, found, json, t, t]
    );
  };

  const prune = async (userId: string): Promise<void> => {
    await db.run(
      `DELETE FROM barcode_cache WHERE user_id = ? AND barcode NOT IN (
         SELECT barcode FROM barcode_cache WHERE user_id = ? ORDER BY last_used_at DESC, rowid DESC LIMIT ?)`,
      [userId, userId, BARCODE_CACHE_CAP]
    );
  };

  return {
    async get(userId, code) {
      const rows = await db.query<Row>(
        `SELECT found, product_json, fetched_at FROM barcode_cache WHERE user_id = ? AND barcode = ?`,
        [userId, code]
      );
      const row = rows[0];
      if (!row) return null;
      let entry: BarcodeCacheEntry | null;
      if (row.found === 1) entry = parseStored(row.product_json);
      else entry = now() - row.fetched_at > NEGATIVE_TTL_MS ? null : { found: false };
      if (!entry) return null;
      await db.run(`UPDATE barcode_cache SET last_used_at = ? WHERE user_id = ? AND barcode = ?`, [
        now(),
        userId,
        code,
      ]);
      return entry;
    },
    async putFound(userId, code, product, attribution) {
      await put(userId, code, 1, JSON.stringify({ product, attribution }));
      await prune(userId);
    },
    async putNotFound(userId, code) {
      await put(userId, code, 0, null);
      await prune(userId);
    },
    prune,
  };
}
