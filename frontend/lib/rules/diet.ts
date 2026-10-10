/**
 * Client port of the server dietary keyword filter (backend/src/modules/ai/dietary-filter.ts).
 *
 * NOTE: best-effort keyword check, NOT a medical-grade allergen guarantee. Matching is
 * whole-word and intentionally over-filters in some cases (e.g. "peanut butter" matches
 * dairy-free "butter"). Parity with the server is locked by backend/tests/fixtures/diet-cases.json.
 *
 * Differences from the server: no lookbehind (older iOS Safari throws on it), caps on
 * restriction count/length, and patterns can be compiled once per run.
 */

const MEAT = [
  'chicken', 'beef', 'pork', 'bacon', 'ham', 'lamb', 'turkey', 'duck', 'veal',
  'sausage', 'steak', 'meat', 'lard', 'mutton', 'venison', 'salami', 'prosciutto',
] as const;
const FISH = [
  'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'anchovy', 'anchovies', 'sardine',
  'mackerel', 'trout', 'herring',
] as const;
const SHELLFISH = [
  'shrimp', 'prawn', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 'scallop',
] as const;
const DAIRY = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'ghee', 'whey'] as const;
const EGG = ['egg', 'mayonnaise'] as const;
const GLUTEN = [
  'wheat', 'flour', 'bread', 'pasta', 'noodle', 'barley', 'rye', 'couscous', 'soy sauce',
] as const;
const NUTS = [
  'peanut', 'almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio',
] as const;

const TAG_TERMS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  vegan: [...MEAT, ...FISH, ...SHELLFISH, ...DAIRY, ...EGG, 'honey', 'gelatin'],
  vegetarian: [...MEAT, ...FISH, ...SHELLFISH, 'gelatin'],
  pescatarian: [...MEAT, 'gelatin'],
  'gluten-free': GLUTEN,
  'dairy-free': DAIRY,
  'lactose-free': DAIRY,
  'nut-free': NUTS,
  'nut-allergy': NUTS,
  'tree-nut-free': NUTS,
  'gluten-intolerant': GLUTEN,
  celiac: GLUTEN,
  'dairy-allergy': DAIRY,
  'lactose-intolerant': DAIRY,
  'egg-allergy': EGG,
  'peanut-allergy': ['peanut'],
  'peanut-free': ['peanut'],
  'shellfish-allergy': SHELLFISH,
  'shellfish-free': SHELLFISH,
  'egg-free': EGG,
  halal: ['pork', 'bacon', 'ham', 'lard', 'gelatin', 'wine', 'beer', 'rum'],
  kosher: ['pork', 'bacon', 'ham', 'lard', 'shrimp', 'crab', 'lobster'],
});

export const MAX_RESTRICTION_LENGTH = 60;

/** Canonical lookup key: lowercase, with underscores, spaces and hyphens unified. */
function canonKey(value: string): string {
  return value.toLowerCase().trim().replace(/[_\s-]+/g, '-');
}

const TAG_INDEX: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries(TAG_TERMS).map(([key, terms]) => [canonKey(key), terms]),
);

const STOP_WORDS: ReadonlySet<string> = new Set([
  'no', 'not', 'free', 'allergy', 'allergic', 'avoid', 'to', 'intolerant',
  'intolerance', 'without', 'a', 'an', 'the', 'and', 'or', 'of', 'any',
]);

const MIN_TOKEN_LENGTH = 3;

export function normalizeRestrictions(
  ...lists: ReadonlyArray<readonly string[] | null | undefined>
): readonly string[] {
  const all = lists.flatMap((list) => list ?? []);
  const cleaned = all
    .map((item) => String(item).toLowerCase().trim().replace(/_+/g, ' ').replace(/\s+/g, ' '))
    .filter((item) => item.length > 0);
  return [...new Set(cleaned)].sort();
}

function singularize(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('es') && /(ch|sh|x|s|z)es$/.test(token)) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

function freeTextTokens(restriction: string): readonly string[] {
  return restriction
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(t))
    .map(singularize);
}

export function buildForbiddenTerms(restrictions: readonly string[]): readonly string[] {
  const terms = normalizeRestrictions(restrictions).flatMap((restriction) => {
    const known = TAG_INDEX.get(canonKey(restriction));
    if (known) return known;
    // Unknown restriction: never pass silently. Forbid the text itself plus its tokens.
    return [restriction, ...freeTextTokens(restriction)];
  });
  return [...new Set(terms)].sort();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lookbehind-free equivalent of the server pattern (prefix group instead of a negative lookbehind). */
function termPattern(term: string): RegExp {
  const body = escapeRegex(term).replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|[^a-z0-9])${body}(?:s|es)?(?![a-z0-9])`, 'i');
}

export function violates(texts: readonly string[], terms: readonly string[]): boolean {
  if (terms.length === 0 || texts.length === 0) return false;
  return violatesCompiled(texts, terms.map(termPattern));
}

/**
 * Build patterns once per run. Every restriction is compiled (no count cap):
 * silently dropping one could surface an allergen. Only per-item length is bounded.
 */
export function compileRestrictions(restrictions: readonly string[]): readonly RegExp[] {
  const bounded = restrictions.map((r) => String(r).slice(0, MAX_RESTRICTION_LENGTH));
  return Object.freeze(buildForbiddenTerms(bounded).map(termPattern));
}

export function violatesCompiled(texts: readonly string[], patterns: readonly RegExp[]): boolean {
  if (patterns.length === 0 || texts.length === 0) return false;
  return texts.some((text) => patterns.some((pattern) => pattern.test(text)));
}
