/**
 * Staples: ingredients a user assumes they always have (salt, oil, ...).
 *
 * Pure helpers. The default list MUST stay identical to the
 * `UserPreference.stapleNames` default in schema.prisma and to the
 * 20261012000000_user_staple_names migration (guarded by a parity test).
 */

import { canonicalName } from './canonical';

export const MAX_STAPLES = 100;
export const MAX_STAPLE_LENGTH = 60;

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
 * Canonicalize, drop empties and de-duplicate (first occurrence wins).
 * Total on unknown input; never throws.
 */
export function sanitizeStapleNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const name = canonicalName(item);
    if (name === '' || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

/**
 * express-validator custom check: every element must be a string of 1-60
 * trimmed characters that canonicalizes to something non-empty.
 */
export function everyStapleIsValid(value: unknown): true {
  if (!Array.isArray(value)) throw new Error('Staples must be a list');
  for (const item of value) {
    if (typeof item !== 'string') throw new Error('Each staple must be text');
    const length = item.trim().length;
    if (length < 1 || length > MAX_STAPLE_LENGTH) {
      throw new Error('Each staple must be 1-60 characters');
    }
    if (canonicalName(item) === '') {
      throw new Error('Each staple must contain letters or numbers');
    }
  }
  return true;
}

/** Stored list -> lookup set. Missing/null falls back to the defaults. */
export function resolveStaples(
  stored: readonly string[] | null | undefined
): ReadonlySet<string> {
  if (stored === null || stored === undefined) return new Set(DEFAULT_STAPLE_NAMES);
  return new Set(sanitizeStapleNames([...stored]));
}

/**
 * A bare discrete count ("3 peppers", unit "pieces") is a thing you buy, not a
 * pantry seasoning, so it is never treated as a staple. This stops the staple
 * `pepper` from swallowing "peppers" (plural folds to the same canonical key).
 */
const isDiscreteCount = (g: { readonly family?: string; readonly countLabel?: string }): boolean =>
  g.family === 'count' && g.countLabel === 'pieces';

/**
 * Split groups into kept vs skipped staples. Matching is exact equality on the
 * canonical name (never substring), so "oil" does not match "sesame oil" and
 * "salt" does not match "salted butter".
 */
export function filterStaples<
  T extends {
    readonly canonical: string;
    readonly displayName: string;
    readonly family?: string;
    readonly countLabel?: string;
  },
>(groups: readonly T[], staples: ReadonlySet<string>): { kept: T[]; skipped: string[] } {
  const kept: T[] = [];
  const skipped: string[] = [];
  for (const group of groups) {
    if (!staples.has(group.canonical) || isDiscreteCount(group)) {
      kept.push(group);
    } else if (!skipped.includes(group.displayName)) {
      skipped.push(group.displayName);
    }
  }
  return { kept, skipped };
}
