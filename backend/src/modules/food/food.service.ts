/**
 * Food lookups: cache -> outbound throttle -> upstream -> cache.
 * Cached entries never consume the outbound throttle.
 */

import { config } from '../../config/env.config';
import { AppError } from '../../middleware/errorHandler';
import { buildCacheKey } from '../ai/ai-cache-key';
import { getCachedSafe, setCachedSafe } from '../ai/ai-cache.repository';
import { AI_ERROR_CODES } from '../ai/ai.errors';
import { OFF_ATTRIBUTION, USDA_ATTRIBUTION, type Attribution } from './food.attribution';
import { FoodUpstreamError } from './food.errors';
import type { FoodProduct, UsdaResult } from './food.types';
import { fetchOffProduct, mapCategory, type OffProduct } from './off.client';
import {
  createOutboundThrottle,
  OFF_THROTTLE_LIMIT,
  OFF_THROTTLE_WINDOW_MS,
  USDA_THROTTLE_LIMIT,
  USDA_THROTTLE_WINDOW_MS,
  type OutboundThrottle,
} from './outbound-throttle';
import { searchUsda } from './usda.client';

const OFF_FEATURE = 'food:off:v1';
const USDA_FEATURE = 'food:usda:v1';
const SCHEMA_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const FOUND_TTL_MS = 30 * DAY_MS;
const NOT_FOUND_TTL_MS = DAY_MS;

export const THROTTLED_MESSAGE = 'Product lookups are busy, try again in a minute.';
export const UNAVAILABLE_MESSAGE = 'Product lookup is unavailable right now, try again later.';
export const NOT_CONFIGURED_MESSAGE = 'Nutrition lookup is not configured';
export const NOT_FOUND_MESSAGE = 'No product found for this barcode.';

export interface FoodDeps {
  readonly usdaApiKey?: string;
  readonly offContact: string;
  readonly offThrottle: OutboundThrottle;
  readonly usdaThrottle: OutboundThrottle;
  readonly now: () => Date;
}

function defaultDeps(): FoodDeps {
  return {
    usdaApiKey: config.foodData.usdaApiKey,
    offContact: config.foodData.offContact,
    offThrottle: createOutboundThrottle({ limit: OFF_THROTTLE_LIMIT, windowMs: OFF_THROTTLE_WINDOW_MS }),
    usdaThrottle: createOutboundThrottle({ limit: USDA_THROTTLE_LIMIT, windowMs: USDA_THROTTLE_WINDOW_MS }),
    now: () => new Date(),
  };
}

let deps: FoodDeps = defaultDeps();

/** Test-only: replace selected deps (a new object is created). */
export function setFoodDepsForTests(
  overrides: Partial<Omit<FoodDeps, 'now'>> & { readonly now?: () => Date }
): void {
  deps = { ...deps, ...overrides };
}

export function resetFoodDepsForTests(): void {
  deps = defaultDeps();
}

type CachedOff = { readonly found: true; readonly product: FoodProduct } | { readonly found: false };

export interface BarcodeResult {
  readonly product: FoodProduct;
  readonly attribution: Attribution;
  readonly cached: boolean;
}

export interface NutritionResult {
  readonly results: readonly UsdaResult[];
  readonly attribution: Attribution;
  readonly cached: boolean;
}

const throttledError = (retryAfterSeconds: number): AppError =>
  new AppError(THROTTLED_MESSAGE, 429, true, {
    code: AI_ERROR_CODES.LOOKUP_THROTTLED,
    details: { retryAfterSeconds },
  });

const unavailableError = (message = UNAVAILABLE_MESSAGE): AppError =>
  new AppError(message, 503, true, { code: AI_ERROR_CODES.LOOKUP_UNAVAILABLE });

const notFoundError = (): AppError =>
  new AppError(NOT_FOUND_MESSAGE, 404, true, {
    code: AI_ERROR_CODES.LOOKUP_NOT_FOUND,
    details: { attribution: OFF_ATTRIBUTION },
  });

function acquire(throttle: OutboundThrottle): void {
  const decision = throttle.tryAcquire();
  if (!decision.allowed) throw throttledError(decision.retryAfterSeconds);
}

function mapUpstreamError(error: unknown): AppError {
  if (error instanceof FoodUpstreamError) {
    return error.kind === 'throttled' ? throttledError(60) : unavailableError();
  }
  return unavailableError();
}

function toProduct(barcode: string, p: OffProduct): FoodProduct {
  const n = p.nutriments;
  return {
    barcode,
    name: p.product_name?.trim() || 'Unknown product',
    brand: p.brands?.trim() || null,
    quantity: p.quantity?.trim() || null,
    imageUrl: p.image_front_small_url ?? null,
    suggestedCategory: mapCategory(p.categories_tags),
    nutritionPer100g: {
      energyKcal: n?.['energy-kcal_100g'] ?? null,
      protein: n?.proteins_100g ?? null,
      fat: n?.fat_100g ?? null,
      carbs: n?.carbohydrates_100g ?? null,
    },
  };
}

export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  const key = buildCacheKey(OFF_FEATURE, SCHEMA_VERSION, { barcode });
  const hit = (await getCachedSafe(key, deps.now())) as CachedOff | null;
  if (hit) {
    if (!hit.found) throw notFoundError();
    return { product: hit.product, attribution: OFF_ATTRIBUTION, cached: true };
  }

  acquire(deps.offThrottle);
  let result;
  try {
    result = await fetchOffProduct(barcode, { contact: deps.offContact });
  } catch (error) {
    throw mapUpstreamError(error);
  }

  const now = deps.now();
  if (result.kind === 'not_found') {
    const entry: CachedOff = { found: false };
    await setCachedSafe({ key, feature: OFF_FEATURE, schemaVersion: SCHEMA_VERSION, payload: entry, ttlMs: NOT_FOUND_TTL_MS, now });
    throw notFoundError();
  }
  const product = toProduct(barcode, result.product);
  const entry: CachedOff = { found: true, product };
  await setCachedSafe({ key, feature: OFF_FEATURE, schemaVersion: SCHEMA_VERSION, payload: entry, ttlMs: FOUND_TTL_MS, now });
  return { product, attribution: OFF_ATTRIBUTION, cached: false };
}

export async function searchNutrition(query: string): Promise<NutritionResult> {
  const apiKey = deps.usdaApiKey;
  if (!apiKey) throw unavailableError(NOT_CONFIGURED_MESSAGE);

  const normalized = query.trim().toLowerCase();
  const key = buildCacheKey(USDA_FEATURE, SCHEMA_VERSION, { query: normalized });
  const hit = (await getCachedSafe(key, deps.now())) as { results: UsdaResult[] } | null;
  if (hit) return { results: hit.results, attribution: USDA_ATTRIBUTION, cached: true };

  acquire(deps.usdaThrottle);
  let results: readonly UsdaResult[];
  try {
    results = await searchUsda(normalized, { apiKey });
  } catch (error) {
    throw mapUpstreamError(error);
  }
  await setCachedSafe({
    key,
    feature: USDA_FEATURE,
    schemaVersion: SCHEMA_VERSION,
    payload: { results },
    ttlMs: FOUND_TTL_MS,
    now: deps.now(),
  });
  return { results, attribution: USDA_ATTRIBUTION, cached: false };
}
