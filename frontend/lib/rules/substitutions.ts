/**
 * Offline substitution lookup over the bundled table.
 * Pure: no network, no mutation of the table. Matching is exact -> alias -> whole-token
 * subset (no edit-distance fuzzy matching: a wrong swap is worse than no swap).
 */

import { canonicalName } from '../preferences/canonical';
import rawTable from './data/substitutions.json';
import { compileRestrictions, violatesCompiled } from './diet';
import { formatAmount, unitLabel } from './format-amount';
import type { SubstitutionEntry, SubstitutionSwap, SubstitutionTable } from './substitution-schema';
import type { SubstituteOptions, SubstituteQuery, SubstituteResult, SuggestedSwap } from './types';
import { familyKey, fromBase, resolveUnit, toBase } from './units';

const TABLE = rawTable as SubstitutionTable;

/** Keys are normalized restriction text (lowercase, hyphens/underscores as spaces). */
export const RESTRICTION_TAG_MAP: Readonly<Record<string, string>> = Object.freeze({
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  'gluten free': 'gluten_free',
  celiac: 'gluten_free',
  'dairy free': 'dairy_free',
  'lactose free': 'dairy_free',
  'dairy allergy': 'dairy_free',
  'nut free': 'nut_free',
  'nut allergy': 'nut_free',
  'tree nut free': 'nut_free',
  'peanut free': 'nut_free',
  'peanut allergy': 'nut_free',
  halal: 'halal',
  kosher: 'kosher',
});

interface TokenKey {
  readonly key: string;
  readonly tokens: readonly string[];
}

const KEY_INDEX: ReadonlyMap<string, SubstitutionEntry> = new Map(
  TABLE.entries.map((entry) => [entry.ingredient, entry]),
);

const ALIAS_INDEX: ReadonlyMap<string, string> = new Map(
  TABLE.entries.flatMap((entry) =>
    entry.aliases.map((alias): [string, string] => [canonicalName(alias), entry.ingredient]),
  ),
);

const TOKEN_KEYS: readonly TokenKey[] = Object.freeze(
  TABLE.entries
    .map((entry) => ({ key: entry.ingredient, tokens: entry.ingredient.split(' ') }))
    .sort(
      (a, b) =>
        b.tokens.length - a.tokens.length ||
        b.key.length - a.key.length ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    ),
);

function tokenSubsetKey(canonical: string): string | null {
  const present = new Set(canonical.split(' '));
  const hit = TOKEN_KEYS.find((candidate) => candidate.tokens.every((t) => present.has(t)));
  return hit ? hit.key : null;
}

function matchCanonical(canonical: string): string | null {
  if (canonical.length === 0) return null;
  if (KEY_INDEX.has(canonical)) return canonical;
  const alias = ALIAS_INDEX.get(canonical);
  if (alias) return alias;
  return tokenSubsetKey(canonical);
}

export function matchSubstitutionKey(name: string): string | null {
  return matchCanonical(canonicalName(name));
}

export function hasSubstitute(canonical: string): boolean {
  return matchCanonical(canonicalName(canonical)) !== null;
}

function normalizeRestriction(raw: string): string {
  return String(raw).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function requiredTags(restrictions: readonly string[]): readonly string[] {
  const tags = restrictions
    .map((r) => RESTRICTION_TAG_MAP[normalizeRestriction(r)])
    .filter((tag): tag is string => typeof tag === 'string');
  return [...new Set(tags)];
}

/** Amounts of one or less (including fractions) read singular: "3/4 cup". */
const label = (unit: string, amount: number): string => unitLabel(unit, amount > 1 ? amount : 1);

const joinWords = (...parts: readonly string[]): string => parts.filter((p) => p !== '').join(' ');

function unscaledLine(swap: SubstitutionSwap, ingredient: string): string {
  const { ratio } = swap;
  const amount = joinWords(formatAmount(ratio.amount, ratio.unit), label(ratio.unit, ratio.amount));
  const per = joinWords(formatAmount(ratio.per, ratio.perUnit), label(ratio.perUnit, ratio.per));
  return `Use ${amount} per ${per} of ${ingredient}`;
}

function scaledLine(swap: SubstitutionSwap, query: SubstituteQuery): string | null {
  const { ratio } = swap;
  const queryUnit = resolveUnit(query.unit);
  const perUnit = resolveUnit(ratio.perUnit);
  if (!Number.isFinite(query.quantity) || query.quantity <= 0) return null;
  if (familyKey(queryUnit) !== familyKey(perUnit)) return null;
  const factor = toBase(query.quantity, queryUnit) / toBase(ratio.per, perUnit);
  let amount = ratio.amount * factor;
  let unit = ratio.unit;
  const swapUnit = resolveUnit(ratio.unit);
  if (swapUnit.family !== 'count' && familyKey(swapUnit) === familyKey(queryUnit)) {
    amount = fromBase(toBase(amount, swapUnit), queryUnit.unitKey);
    unit = queryUnit.unitKey;
  }
  const given = joinWords(
    formatAmount(amount, unit),
    label(unit, amount),
    swap.name,
  );
  const need = joinWords(
    formatAmount(query.quantity, queryUnit.unitKey),
    label(queryUnit.unitKey, query.quantity),
    query.ingredientName.trim(),
  );
  return `Use ${given} for ${need}`;
}

function toSuggested(
  swap: SubstitutionSwap,
  query: SubstituteQuery,
  options: SubstituteOptions,
): SuggestedSwap {
  const ingredient = query.ingredientName.trim();
  return Object.freeze({
    name: swap.name,
    ratioLine: scaledLine(swap, query) ?? unscaledLine(swap, ingredient),
    note: swap.note,
    tags: Object.freeze([...swap.tags]),
    inPantry: swap.pantryNames.every((n) => options.pantryHas(canonicalName(n))),
    rank: swap.rank,
  });
}

function compareSwaps(a: SuggestedSwap, b: SuggestedSwap): number {
  if (a.inPantry !== b.inPantry) return a.inPantry ? -1 : 1;
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export function findSubstitutes(
  query: SubstituteQuery,
  options: SubstituteOptions,
): SubstituteResult | null {
  const key = matchSubstitutionKey(query.ingredientName);
  const entry = key ? KEY_INDEX.get(key) : undefined;
  if (!entry) return null;

  const tags = requiredTags(options.restrictions);
  const patterns = compileRestrictions(options.restrictions);
  const allowed = entry.swaps.filter(
    (swap) =>
      tags.every((tag) => (swap.tags as readonly string[]).includes(tag)) &&
      !violatesCompiled([swap.name, ...swap.pantryNames], patterns),
  );
  const swaps = allowed.map((swap) => toSuggested(swap, query, options)).sort(compareSwaps);
  return Object.freeze({
    ingredient: entry.ingredient,
    swaps: Object.freeze(swaps),
    hiddenCount: entry.swaps.length - allowed.length,
  });
}
