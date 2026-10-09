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

function cleanText(input: string): string {
  let text = input.slice(0, MAX_INPUT_LENGTH).normalize('NFKC').toLowerCase();
  text = text.replace(/&/g, ' and ').replace(/\([^)]*\)/g, ' ');
  const cut = text.search(/[,:]/);
  if (cut >= 0) text = text.slice(0, cut);
  return text
    .replace(/['‘’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function canonicalName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = cleanText(raw);
  if (cleaned.length === 0) return '';
  const singular = singularizeLast(cleaned);
  return hasOwn(INGREDIENT_ALIASES, singular) ? INGREDIENT_ALIASES[singular] : singular;
}
