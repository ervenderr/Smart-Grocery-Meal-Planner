/**
 * Canonical ingredient name: a conservative, idempotent MATCHING KEY only.
 * Callers keep the original text for display.
 *
 * Total on unknown input (returns '' for non-strings), input is truncated
 * before any regex, and every regex is a single-pass character class
 * (no nested quantifiers) so it cannot backtrack catastrophically.
 */

const MAX_INPUT_LENGTH = 200;
const MIN_SINGULAR_LENGTH = 3;

export const INGREDIENT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  scallion: 'green onion',
  'spring onion': 'green onion',
  'green onion': 'green onion',
  aubergine: 'eggplant',
  courgette: 'zucchini',
  capsicum: 'bell pepper',
  'garbanzo bean': 'chickpea',
  garbanzo: 'chickpea',
  prawn: 'shrimp',
  'icing sugar': 'powdered sugar',
  'confectioners sugar': 'powdered sugar',
  'bicarbonate of soda': 'baking soda',
  'plain flour': 'all purpose flour',
  'coriander leaf': 'cilantro',
});

export const PLURAL_INVARIANTS: ReadonlySet<string> = new Set([
  'hummus', 'asparagus', 'couscous', 'molasses', 'oats', 'grits',
  'watercress', 'cress', 'citrus', 'lemongrass', 'swiss', 'bass',
]);

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

function singularizeWord(word: string): string {
  if (PLURAL_INVARIANTS.has(word) || /(ss|us|is)$/.test(word)) return word;
  const candidates: string[] = [];
  if (word.endsWith('ies')) candidates.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('oes')) candidates.push(word.slice(0, -2));
  if (/(ch|sh|ss|x)es$/.test(word)) candidates.push(word.slice(0, -2));
  if (word.endsWith('s')) candidates.push(word.slice(0, -1));
  const hit = candidates.find((c) => c.length >= MIN_SINGULAR_LENGTH);
  return hit ?? word;
}

function singularizeLast(text: string): string {
  const idx = text.lastIndexOf(' ');
  const head = idx >= 0 ? text.slice(0, idx + 1) : '';
  return head + singularizeWord(idx >= 0 ? text.slice(idx + 1) : text);
}

/**
 * Prep/serving notes that never change which ingredient it is. A comma,
 * colon or parenthetical segment is dropped ONLY when every word is listed
 * here; anything else is a qualifier ("black", "olive", "brown") and stays
 * part of the identity.
 */
export const NOTE_WORDS: ReadonlySet<string> = new Set([
  'chopped', 'diced', 'minced', 'sliced', 'divided', 'melted', 'softened',
  'fresh', 'freshly', 'finely', 'roughly', 'coarsely', 'thinly', 'peeled',
  'grated', 'shredded', 'cubed', 'halved', 'sifted', 'drained', 'rinsed',
  'packed', 'room', 'temperature', 'to', 'taste', 'optional', 'as', 'needed',
  'for', 'garnish', 'serving', 'more', 'extra', 'plus', 'or', 'and',
]);

/**
 * Head nouns that are a category rather than a product ("pepper, black").
 * For these the qualifier moves in front so "Pepper, black" and "Black
 * pepper" share a key. Any other head keeps its written order.
 */
export const CATEGORY_HEADS: ReadonlySet<string> = new Set([
  'pepper', 'oil', 'sugar', 'flour', 'vinegar', 'sauce', 'salt', 'cheese',
  'milk', 'cream', 'butter', 'rice', 'syrup', 'juice', 'stock', 'broth',
  'powder', 'paste', 'seed', 'bean', 'onion',
]);

/** Parenthetical words that mark a measurement, not a qualifier. */
const MEASURE_WORDS: ReadonlySet<string> = new Set([
  'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'g', 'kg', 'ml', 'l',
  'stick', 'sticks', 'can', 'cans', 'pinch', 'clove', 'cloves', 'about', 'approx',
]);

const toWords = (segment: string): string[] =>
  segment
    .replace(/['\u2018\u2019]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);

/** Parenthetical: keep its content as a qualifier segment unless it is a measurement. */
function parenSegment(content: string): string {
  const words = toWords(content);
  const measure = /\d/.test(content) || words.some((w) => MEASURE_WORDS.has(w));
  return measure ? ' ' : `,${content},`;
}

/** Splits into a head plus qualifier words (prep notes removed). */
function splitIdentity(input: string): { head: string[]; qualifiers: string[] } {
  const text = input
    .slice(0, MAX_INPUT_LENGTH)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\(([^)]*)\)/g, (_m, content: string) => parenSegment(content));
  const [first = '', ...rest] = text.split(/[,:]/);
  const qualifiers = rest
    .map(toWords)
    .filter((words) => words.length > 0 && !words.every((w) => NOTE_WORDS.has(w)))
    .flat();
  return { head: toWords(first), qualifiers };
}

function cleanText(input: string): string {
  const { head, qualifiers } = splitIdentity(input);
  if (qualifiers.length === 0) return head.join(' ');
  const headIsCategory = head.length > 0 && CATEGORY_HEADS.has(singularizeWord(head[head.length - 1]));
  return (headIsCategory ? [...qualifiers, ...head] : [...head, ...qualifiers]).join(' ');
}

export function canonicalName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = cleanText(raw);
  if (cleaned.length === 0) return '';
  const singular = singularizeLast(cleaned);
  return hasOwn(INGREDIENT_ALIASES, singular) ? INGREDIENT_ALIASES[singular] : singular;
}
