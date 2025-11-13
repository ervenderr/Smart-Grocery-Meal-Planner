/**
 * Measurement Units
 */

export const WEIGHT_UNITS = [
  { value: 'g', label: 'Grams (g)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'lb', label: 'Pounds (lb)' },
] as const;

export const VOLUME_UNITS = [
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'l', label: 'Liters (l)' },
  { value: 'tsp', label: 'Teaspoon (tsp)' },
  { value: 'tbsp', label: 'Tablespoon (tbsp)' },
  { value: 'cup', label: 'Cup' },
  { value: 'fl-oz', label: 'Fluid Ounce (fl oz)' },
  { value: 'gal', label: 'Gallon (gal)' },
] as const;

export const COUNT_UNITS = [
  { value: 'piece', label: 'Piece(s)' },
  { value: 'unit', label: 'Unit(s)' },
  { value: 'dozen', label: 'Dozen' },
] as const;

export const ALL_UNITS = [...WEIGHT_UNITS, ...VOLUME_UNITS, ...COUNT_UNITS] as const;

/**
 * Get unit label by value
 */
export function getUnitLabel(value: string): string {
  const unit = ALL_UNITS.find((u) => u.value === value);
  return unit ? unit.label : value;
}

/**
 * Unit conversions (approximate)
 */
export const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  // Weight conversions (to grams)
  g: { g: 1, kg: 0.001, oz: 0.035274, lb: 0.00220462 },
  kg: { g: 1000, kg: 1, oz: 35.274, lb: 2.20462 },
  oz: { g: 28.3495, kg: 0.0283495, oz: 1, lb: 0.0625 },
  lb: { g: 453.592, kg: 0.453592, oz: 16, lb: 1 },

  // Volume conversions (to ml)
  ml: { ml: 1, l: 0.001, tsp: 0.202884, tbsp: 0.067628, cup: 0.00422675, 'fl-oz': 0.033814, gal: 0.000264172 },
  l: { ml: 1000, l: 1, tsp: 202.884, tbsp: 67.628, cup: 4.22675, 'fl-oz': 33.814, gal: 0.264172 },
  tsp: { ml: 4.92892, l: 0.00492892, tsp: 1, tbsp: 0.333333, cup: 0.0208333, 'fl-oz': 0.166667, gal: 0.00130208 },
  tbsp: { ml: 14.7868, l: 0.0147868, tsp: 3, tbsp: 1, cup: 0.0625, 'fl-oz': 0.5, gal: 0.00390625 },
  cup: { ml: 236.588, l: 0.236588, tsp: 48, tbsp: 16, cup: 1, 'fl-oz': 8, gal: 0.0625 },
  'fl-oz': { ml: 29.5735, l: 0.0295735, tsp: 6, tbsp: 2, cup: 0.125, 'fl-oz': 1, gal: 0.0078125 },
  gal: { ml: 3785.41, l: 3.78541, tsp: 768, tbsp: 256, cup: 16, 'fl-oz': 128, gal: 1 },
};

/**
 * Convert between units
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return value;

  const conversion = UNIT_CONVERSIONS[fromUnit];
  if (!conversion || !(toUnit in conversion)) {
    return value; // Cannot convert, return original
  }

  return value * conversion[toUnit];
}
