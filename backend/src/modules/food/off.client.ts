/**
 * Open Food Facts product client. Host is hard-coded; the barcode is validated
 * upstream of this module. Upstream data is untrusted and Zod-validated.
 */

import { z } from 'zod';
import { logger } from '../../config/logger.config';
import { FoodUpstreamError } from './food.errors';
import type { PantryCategory } from './food.types';

export { FoodUpstreamError };

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS =
  'code,product_name,brands,quantity,categories_tags,nutriments,image_front_small_url';

const str = z.string().max(300);
const num = z.preprocess((v) => {
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return v;
}, z.number().finite().optional());

const productSchema = z.object({
  code: str.optional(),
  product_name: str.optional(),
  brands: str.optional(),
  quantity: str.optional(),
  image_front_small_url: str.optional(),
  categories_tags: z.array(str).max(200).optional(),
  nutriments: z
    .object({
      'energy-kcal_100g': num,
      proteins_100g: num,
      fat_100g: num,
      carbohydrates_100g: num,
    })
    .optional(),
});

const bodySchema = z.object({
  status: z.union([z.number(), z.string()]).optional(),
  product: productSchema.optional(),
});

const IMAGE_HOST = 'openfoodfacts.org';

/** Only https images on openfoodfacts.org (or a subdomain) are passed to clients. */
export function safeImageUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed = host === IMAGE_HOST || host.endsWith(`.${IMAGE_HOST}`);
    return url.protocol === 'https:' && allowed && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export type OffProduct = z.infer<typeof productSchema>;
export type OffResult =
  | { readonly kind: 'found'; readonly product: OffProduct }
  | { readonly kind: 'not_found' };

export interface OffOptions {
  readonly contact: string;
  readonly timeoutMs?: number;
}

const CATEGORY_RULES: ReadonlyArray<readonly [PantryCategory, readonly string[]]> = Object.freeze([
  ['dairy', ['dairies', 'milks', 'cheeses', 'yogurts', 'butters']],
  ['protein', ['meats', 'fishes', 'seafood', 'eggs', 'poultry']],
  ['vegetable', ['vegetables']],
  ['fruit', ['fruits']],
  ['grains', ['cereals', 'breads', 'pastas', 'rices', 'flours']],
  ['spices', ['spices', 'herbs']],
  ['canned', ['canned']],
  ['frozen', ['frozen']],
  ['beverages', ['beverages', 'waters', 'juices']],
  ['condiments', ['sauces', 'condiments']],
]);

export function mapCategory(categoriesTags: readonly string[] | undefined): PantryCategory {
  const tags = (categoriesTags ?? []).map((t) => t.toLowerCase());
  for (const [category, keywords] of CATEGORY_RULES) {
    if (tags.some((tag) => keywords.some((k) => tag.includes(k)))) return category;
  }
  return 'other';
}

async function request(barcode: string, opts: OffOptions): Promise<Response> {
  try {
    return await fetch(`${OFF_BASE}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': `Kitcha/1.0 (${opts.contact})`, Accept: 'application/json' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
  } catch {
    logger.warn('OFF request failed', { kind: 'network' });
    throw new FoodUpstreamError('unavailable', 'OFF network error');
  }
}

export async function fetchOffProduct(barcode: string, opts: OffOptions): Promise<OffResult> {
  const response = await request(barcode, opts);
  if (response.status === 404) return { kind: 'not_found' };
  if (response.status === 429) {
    logger.warn('OFF throttled us', { status: 429 });
    throw new FoodUpstreamError('throttled', 'OFF rate limited');
  }
  if (!response.ok) {
    logger.warn('OFF upstream error', { status: response.status });
    throw new FoodUpstreamError('unavailable', `OFF status ${response.status}`);
  }
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await response.json());
  } catch {
    logger.warn('OFF returned an unexpected body', { status: response.status });
    throw new FoodUpstreamError('unavailable', 'OFF malformed body');
  }
  if (Number(parsed.status) !== 1 || !parsed.product) return { kind: 'not_found' };
  return { kind: 'found', product: parsed.product };
}
