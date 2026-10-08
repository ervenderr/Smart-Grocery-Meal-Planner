/**
 * Dietary / allergen output filter (pure functions).
 *
 * NOTE: This is a best-effort keyword filter applied to AI output. It is NOT a
 * medical-grade allergen guarantee. Matching is whole-word and intentionally
 * over-filters in some cases (e.g. "peanut butter" matches dairy-free "butter").
 * Restrictions are never sent to the AI provider; they are only applied here.
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
  'peanut allergy': ['peanut'],
  'peanut-free': ['peanut'],
  'shellfish allergy': SHELLFISH,
  'shellfish-free': SHELLFISH,
  'egg-free': EGG,
  halal: ['pork', 'bacon', 'ham', 'lard', 'gelatin', 'wine', 'beer', 'rum'],
  kosher: ['pork', 'bacon', 'ham', 'lard', 'shrimp', 'crab', 'lobster'],
});

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
    .map((item) => String(item).toLowerCase().trim().replace(/\s+/g, ' '))
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
    const known = TAG_TERMS[restriction];
    return known ?? freeTextTokens(restriction);
  });
  return [...new Set(terms)].sort();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termPattern(term: string): RegExp {
  const body = escapeRegex(term).replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![a-z0-9])${body}(?:s|es)?(?![a-z0-9])`, 'i');
}

export function violates(texts: readonly string[], terms: readonly string[]): boolean {
  if (terms.length === 0 || texts.length === 0) return false;
  const patterns = terms.map(termPattern);
  return texts.some((text) => patterns.some((pattern) => pattern.test(text)));
}

export function partitionByRestrictions<T>(
  items: readonly T[],
  getTexts: (item: T) => readonly string[],
  restrictions: readonly string[],
): { readonly kept: readonly T[]; readonly removedCount: number } {
  const terms = buildForbiddenTerms(restrictions);
  const kept = items.filter((item) => !violates(getTexts(item), terms));
  return { kept, removedCount: items.length - kept.length };
}
