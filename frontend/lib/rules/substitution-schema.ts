import { z } from 'zod';

/** Mirrors DietaryRestriction in frontend/types/recipe.types.ts. */
export const DIETARY_TAGS = Object.freeze([
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'halal',
  'kosher',
] as const);

/** Mirrors the app ingredient unit enum. */
export const RATIO_UNITS = Object.freeze([
  'grams',
  'kg',
  'oz',
  'lbs',
  'ml',
  'liters',
  'tsp',
  'tbsp',
  'fl_oz',
  'cups',
  'pieces',
  'items',
] as const);

export const MAX_NOTE_LENGTH = 200;

const unitSchema = z.enum(RATIO_UNITS);

export const swapRatioSchema = z
  .object({
    amount: z.number().positive(),
    unit: unitSchema,
    per: z.number().positive(),
    perUnit: unitSchema,
  })
  .strict();

export const substitutionSwapSchema = z
  .object({
    name: z.string().min(1),
    pantryNames: z.array(z.string().min(1)).min(1),
    ratio: swapRatioSchema,
    note: z.string().min(1).max(MAX_NOTE_LENGTH),
    tags: z.array(z.enum(DIETARY_TAGS)),
    rank: z.number().int().min(1),
  })
  .strict();

export const substitutionEntrySchema = z
  .object({
    ingredient: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    swaps: z.array(substitutionSwapSchema).min(1),
  })
  .strict();

export const substitutionTableSchema = z
  .object({
    schemaVersion: z.literal(1),
    entries: z.array(substitutionEntrySchema),
  })
  .strict();

export type SubstitutionSwap = z.infer<typeof substitutionSwapSchema>;
export type SubstitutionEntry = z.infer<typeof substitutionEntrySchema>;
export type SubstitutionTable = z.infer<typeof substitutionTableSchema>;
