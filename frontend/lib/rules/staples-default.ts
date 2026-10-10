/**
 * Bundled default staples. MUST equal backend/src/modules/intelligence/staples.ts
 * DEFAULT_STAPLE_NAMES (guarded by backend/tests/fixtures/default-staples.json).
 */
import { canonicalName } from '@/lib/preferences/canonical';

export const DEFAULT_STAPLE_NAMES: readonly string[] = Object.freeze([
  'salt',
  'black pepper',
  'pepper',
  'water',
  'sugar',
  'flour',
  'all purpose flour',
  'cooking oil',
  'vegetable oil',
  'olive oil',
  'baking soda',
  'baking powder',
  'cornstarch',
  'vinegar',
  'soy sauce',
]);

/**
 * Source priority: user stapleNames, then server-provided defaults,
 * then the bundled list. An explicit empty list means "no staples".
 */
export function resolveStapleSet(
  stapleNames?: readonly string[],
  defaultStapleNames?: readonly string[],
): ReadonlySet<string> {
  const source = stapleNames ?? defaultStapleNames ?? DEFAULT_STAPLE_NAMES;
  const names = source
    .filter((n): n is string => typeof n === 'string')
    .map((n) => canonicalName(n))
    .filter((n) => n !== '');
  return new Set(names);
}
