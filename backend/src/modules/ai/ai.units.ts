/**
 * Unit normalization. AI output must always map onto the PantryUnit values
 * the frontend and pantry model accept.
 */

export const PANTRY_UNITS = [
  'lbs', 'kg', 'grams', 'oz', 'cups', 'ml', 'liters',
  'tsp', 'tbsp', 'fl_oz', 'pieces', 'items',
] as const;

export type PantryUnitValue = (typeof PANTRY_UNITS)[number];

const UNIT_ALIASES: Readonly<Record<string, PantryUnitValue>> = {
  lb: 'lbs', pound: 'lbs', pounds: 'lbs',
  kilogram: 'kg', kilograms: 'kg',
  gram: 'grams', g: 'grams',
  ounce: 'oz', ounces: 'oz',
  cup: 'cups', c: 'cups',
  milliliter: 'ml', milliliters: 'ml',
  liter: 'liters', l: 'liters',
  teaspoon: 'tsp', teaspoons: 'tsp', t: 'tsp', pinch: 'tsp', dash: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp', 'tbsp.': 'tbsp', tbs: 'tbsp',
  'fluid ounce': 'fl_oz', 'fluid ounces': 'fl_oz', 'fl oz': 'fl_oz', floz: 'fl_oz',
  piece: 'pieces', pcs: 'pieces', pc: 'pieces', unit: 'pieces', units: 'pieces',
  whole: 'pieces', clove: 'pieces', cloves: 'pieces',
  item: 'items', can: 'items', cans: 'items', bottle: 'items', bottles: 'items',
  package: 'items', packages: 'items',
};

export function normalizeUnit(raw: string): PantryUnitValue {
  const lower = raw.toLowerCase().trim();
  if ((PANTRY_UNITS as readonly string[]).includes(lower)) return lower as PantryUnitValue;
  return UNIT_ALIASES[lower] ?? 'pieces';
}
