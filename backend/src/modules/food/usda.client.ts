/**
 * USDA FoodData Central search client. The API key travels only in the
 * X-Api-Key header and is never logged.
 */

import { z } from 'zod';
import { logger } from '../../config/logger.config';
import { FoodUpstreamError } from './food.errors';
import type { NutritionPer100g, UsdaResult } from './food.types';

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';

const nutrientSchema = z.object({
  nutrientNumber: z.union([z.string(), z.number()]).optional(),
  nutrientName: z.string().max(200).optional(),
  value: z.number().finite().optional(),
});

const bodySchema = z.object({
  foods: z
    .array(
      z.object({
        fdcId: z.number().int(),
        description: z.string().max(300),
        dataType: z.string().max(100).optional(),
        foodNutrients: z.array(nutrientSchema).max(500).optional(),
      })
    )
    .max(50)
    .default([]),
});

type Nutrient = z.infer<typeof nutrientSchema>;

function pick(nutrients: readonly Nutrient[], number: string, namePattern: RegExp): number | null {
  const hit =
    nutrients.find((n) => n.nutrientNumber !== undefined && String(n.nutrientNumber) === number) ??
    nutrients.find((n) => n.nutrientName !== undefined && namePattern.test(n.nutrientName));
  return hit?.value ?? null;
}

function mapNutrition(nutrients: readonly Nutrient[]): NutritionPer100g {
  return {
    energyKcal: pick(nutrients, '208', /^energy$/i),
    protein: pick(nutrients, '203', /^protein$/i),
    fat: pick(nutrients, '204', /^total lipid/i),
    carbs: pick(nutrients, '205', /^carbohydrate/i),
  };
}

export interface UsdaOptions {
  readonly apiKey: string;
  readonly timeoutMs?: number;
}

export async function searchUsda(query: string, opts: UsdaOptions): Promise<readonly UsdaResult[]> {
  const url = `${USDA_BASE}?query=${encodeURIComponent(query)}&pageSize=5&dataType=${encodeURIComponent('Foundation,SR Legacy')}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'X-Api-Key': opts.apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
  } catch {
    logger.warn('USDA request failed', { kind: 'network' });
    throw new FoodUpstreamError('unavailable', 'USDA network error');
  }
  if (response.status === 429) {
    logger.warn('USDA throttled us', { status: 429 });
    throw new FoodUpstreamError('throttled', 'USDA rate limited');
  }
  if (!response.ok) {
    logger.warn('USDA upstream error', { status: response.status });
    throw new FoodUpstreamError('unavailable', `USDA status ${response.status}`);
  }
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await response.json());
  } catch {
    logger.warn('USDA returned an unexpected body', { status: response.status });
    throw new FoodUpstreamError('unavailable', 'USDA malformed body');
  }
  return parsed.foods.map((f) => ({
    fdcId: f.fdcId,
    description: f.description,
    dataType: f.dataType ?? 'Unknown',
    nutritionPer100g: mapNutrition(f.foodNutrients ?? []),
  }));
}
