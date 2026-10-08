/** Mirrors backend users.validation.ts (preferredUnit and mealsPerDay). */
export const PREFERRED_UNITS = ['kg', 'lb', 'g', 'oz'] as const;
export type PreferredUnit = (typeof PREFERRED_UNITS)[number];

export const PREFERRED_UNIT_OPTIONS: ReadonlyArray<{ value: PreferredUnit; label: string }> = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'lb', label: 'Pounds (lb)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'oz', label: 'Ounces (oz)' },
];

export const DEFAULT_PREFERRED_UNIT: PreferredUnit = 'kg';
export const MIN_MEALS_PER_DAY = 1;
export const MAX_MEALS_PER_DAY = 5;

/** Keep a stored unit when the backend allows it; only unknown values fall back to kg. */
export function normalizePreferredUnit(value: string | null | undefined): PreferredUnit {
  return (PREFERRED_UNITS as ReadonlyArray<string>).includes(value ?? '')
    ? (value as PreferredUnit)
    : DEFAULT_PREFERRED_UNIT;
}
