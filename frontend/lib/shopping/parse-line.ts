/**
 * Mirrored free-text ingredient line parser for Shopping quick-add ("2 kg rice").
 *
 * MIRROR of backend/src/modules/intelligence/parse-line.ts (and the unit alias
 * table in units.ts). The shared fixture backend/tests/fixtures/parse-line-cases.json
 * is the guard: parse-line.test.ts must pass for every row. Integer math only.
 */

import { MAX_ITEM_NAME_LENGTH, MAX_QUANTITY, MIN_QUANTITY } from './vocab';

export const MAX_LINE_LENGTH = 200;
const MAX_VALUE = 99999;
const MAX_INT_DIGITS = 5;
const MAX_FRAC_DIGITS = 4;
const MAX_FRACTION_NUM_DIGITS = 5;
const MAX_FRACTION_DEN_DIGITS = 4;

export interface ParsedLine {
  /** Two-decimal string, e.g. "2.50". */
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly name: string;
  readonly note: string | null;
}

type Term = { readonly num: number; readonly den: number; readonly big: boolean; readonly end: number };

type UnitMatch = { readonly unit: string; readonly end: number };

const VULGAR: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  '½': [1, 2], '⅓': [1, 3], '⅔': [2, 3], '¼': [1, 4], '¾': [3, 4],
  '⅕': [1, 5], '⅖': [2, 5], '⅗': [3, 5], '⅘': [4, 5], '⅙': [1, 6], '⅚': [5, 6],
  '⅐': [1, 7], '⅛': [1, 8], '⅜': [3, 8], '⅝': [5, 8], '⅞': [7, 8], '⅑': [1, 9], '⅒': [1, 10],
});

// Mass/volume aliases: keep in sync with ALIASES in backend units.ts (family != count only).
const UNIT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  g: 'grams', gram: 'grams', grams: 'grams', gr: 'grams',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lbs', lbs: 'lbs', pound: 'lbs', pounds: 'lbs',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'liters', liter: 'liters', liters: 'liters', litre: 'liters', litres: 'liters',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  floz: 'fl_oz', cup: 'cups', cups: 'cups',
});

const PIECE_WORDS: ReadonlySet<string> = new Set(['piece', 'pieces', 'item', 'items']);
const COUNT_UNIT_ALLOWLIST: ReadonlySet<string> = new Set([
  'clove', 'can', 'slice', 'bunch', 'sprig', 'stalk', 'head', 'package', 'pack', 'jar', 'bottle',
  'stick', 'dozen', 'pinch',
]);
const FLOZ_FIRST: ReadonlySet<string> = new Set(['fl', 'fluid']);
const FLOZ_SECOND: ReadonlySet<string> = new Set(['oz', 'ounce', 'ounces']);
const PREFIX_PHRASES: readonly string[] = [
  'a pinch of ', 'pinch of ', 'a dash of ', 'dash of ', 'a handful of ', 'handful of ', 'a few ', 'some ',
];
const SUFFIX_PHRASES: readonly string[] = [' to taste', ' as needed'];
const LETTER = /^\p{L}$/u;
const DASHES: ReadonlySet<string> = new Set(['-', '–']);
const isDigit = (c: string): boolean => c >= '0' && c <= '9' && c.length === 1;
const isSpace = (c: string): boolean => c !== '' && c.trim() === '';
const isLetter = (c: string): boolean => c !== '' && LETTER.test(c);

function skipSpace(s: string, i: number): number {
  let j = i;
  while (isSpace(s.charAt(j))) j += 1;
  return j;
}

function readWord(s: string, i: number): { word: string; end: number } {
  let j = i;
  while (isLetter(s.charAt(j))) j += 1;
  return { word: s.slice(i, j).toLowerCase(), end: j };
}

function readDigits(s: string, i: number, commas: boolean): { digits: string; end: number } {
  let j = i;
  let digits = '';
  for (;;) {
    const c = s.charAt(j);
    const thousands =
      commas && c === ',' && digits.length > 0 &&
      isDigit(s.charAt(j + 1)) && isDigit(s.charAt(j + 2)) && isDigit(s.charAt(j + 3)) &&
      !isDigit(s.charAt(j + 4));
    if (isDigit(c)) {
      digits += c;
      j += 1;
    } else if (thousands) {
      j += 1;
    } else {
      return { digits, end: j };
    }
  }
}

function readFraction(s: string, i: number): Term | null {
  const top = readDigits(s, i, false);
  if (top.digits === '' || s.charAt(top.end) !== '/') return null;
  const bottom = readDigits(s, top.end + 1, false);
  if (bottom.digits === '') return null;
  const den = Number(bottom.digits);
  if (den === 0) return null;
  const big =
    top.digits.length > MAX_FRACTION_NUM_DIGITS || bottom.digits.length > MAX_FRACTION_DEN_DIGITS;
  return { num: big ? 0 : Number(top.digits), den: big ? 1 : den, big, end: bottom.end };
}

function readMixedTail(s: string, j: number): Term | null {
  if (s.charAt(j) === '-') return readFraction(s, j + 1);
  const k = skipSpace(s, j);
  const vulgar = VULGAR[s.charAt(k)];
  return vulgar ? { num: vulgar[0], den: vulgar[1], big: false, end: k + 1 } : readFraction(s, k);
}

function readDecimal(s: string, i: number): Term | null {
  const whole = readDigits(s, i, true);
  let end = whole.end;
  let frac = '';
  if (s.charAt(end) === '.' && isDigit(s.charAt(end + 1))) {
    const f = readDigits(s, end + 1, false);
    frac = f.digits.slice(0, MAX_FRAC_DIGITS);
    end = f.end;
  }
  if (whole.digits === '' && frac === '') return null;
  const intDigits = whole.digits.replace(/^0+/, '');
  if (intDigits.length > MAX_INT_DIGITS) return { num: 0, den: 1, big: true, end };
  const den = 10 ** frac.length;
  const num = Number(`${intDigits}${frac}` || '0');
  const tail = frac === '' ? readMixedTail(s, end) : null;
  if (tail) return tail.big ? tail : { num: num * tail.den + tail.num, den: tail.den, big: false, end: tail.end };
  return { num, den, big: false, end };
}

function readNumber(s: string, i: number): Term | null {
  const vulgar = VULGAR[s.charAt(i)];
  if (vulgar) return { num: vulgar[0], den: vulgar[1], big: false, end: i + 1 };
  return readFraction(s, i) ?? readDecimal(s, i);
}

function larger(a: Term, b: Term): Term {
  if (a.big || b.big) return { num: 0, den: 1, big: true, end: b.end };
  return a.num * b.den >= b.num * a.den ? { ...a, end: b.end } : b;
}

function readRange(s: string, i: number): Term | null {
  const first = readNumber(s, i);
  if (!first) return null;
  const k = skipSpace(s, first.end);
  const isTo = k > first.end && s.slice(k, k + 2).toLowerCase() === 'to' && isSpace(s.charAt(k + 2));
  const sepLen = DASHES.has(s.charAt(k)) ? 1 : isTo ? 2 : 0;
  if (sepLen === 0) return first;
  const second = readNumber(s, skipSpace(s, k + sepLen));
  return second ? larger(first, second) : first;
}

function countUnit(word: string): string | null {
  if (PIECE_WORDS.has(word)) return 'pieces';
  const stems = [word, word.endsWith('s') ? word.slice(0, -1) : '', word.endsWith('es') ? word.slice(0, -2) : ''];
  return stems.find((c) => c !== '' && COUNT_UNIT_ALLOWLIST.has(c)) ?? null;
}

const afterDot = (s: string, end: number): number => (s.charAt(end) === '.' ? end + 1 : end);

function readUnit(s: string, i: number): UnitMatch | null {
  const first = readWord(s, i);
  if (first.word === '') return null;
  if (FLOZ_FIRST.has(first.word)) {
    const second = readWord(s, skipSpace(s, first.end));
    if (FLOZ_SECOND.has(second.word)) return { unit: 'fl_oz', end: afterDot(s, second.end) };
  }
  const alias = Object.prototype.hasOwnProperty.call(UNIT_ALIASES, first.word)
    ? UNIT_ALIASES[first.word]
    : null;
  if (alias) return { unit: alias, end: afterDot(s, first.end) };
  const count = countUnit(first.word);
  return count ? { unit: count, end: afterDot(s, first.end) } : null;
}

function dropLeadingOf(rest: string): string {
  const trimmed = rest.trim();
  const lower = trimmed.slice(0, 3).toLowerCase();
  if (lower === 'of ') return trimmed.slice(3).trim();
  return trimmed.toLowerCase() === 'of' ? '' : trimmed;
}

const plain = (name: string): ParsedLine => ({ quantity: null, unit: null, name, note: null });

/** Round half up to hundredths using integers only; null when out of bounds. */
function formatQuantity(num: number, den: number): string | null {
  const hundredths = Math.floor((num * 200 + den) / (2 * den));
  if (num <= 0 || hundredths < 1 || num > den * MAX_VALUE) return null;
  return `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`;
}

function toQuantity(term: Term): string | null {
  return term.big ? null : formatQuantity(term.num, term.den);
}

function stripNoQuantityPhrases(text: string): string | null {
  let name = text;
  let matched = false;
  for (const p of PREFIX_PHRASES) {
    if (name.slice(0, p.length).toLowerCase() === p) {
      name = name.slice(p.length);
      matched = true;
      break;
    }
  }
  for (const p of SUFFIX_PHRASES) {
    if (name.length >= p.length && name.slice(-p.length).toLowerCase() === p) {
      name = name.slice(0, -p.length);
      matched = true;
      break;
    }
  }
  return matched ? name.trim().replace(/,+$/, '').trim() : null;
}

function parseArticle(text: string): ParsedLine | null {
  const lead = readWord(text, 0);
  if ((lead.word !== 'a' && lead.word !== 'an') || !isSpace(text.charAt(lead.end))) return null;
  const unit = readUnit(text, skipSpace(text, lead.end));
  if (!unit) return null;
  return {
    quantity: '1.00',
    unit: unit.unit,
    name: dropLeadingOf(text.slice(unit.end)),
    note: null,
  };
}

function parseNumeric(text: string): ParsedLine {
  const term = readRange(text, 0);
  if (!term) return plain(text);
  const c = text.charAt(term.end);
  const glued = isLetter(c) ? readUnit(text, term.end) : null;
  const boundaryOk = c === '' || isSpace(c) || c === '(' || glued !== null;
  if (!boundaryOk) return plain(text);
  let j = skipSpace(text, term.end);
  if (text.charAt(j) === '%' || readWord(text, j).word === 'percent') return plain(text);
  let note: string | null = null;
  if (text.charAt(j) === '(') {
    const close = text.indexOf(')', j);
    if (close > j) {
      note = text.slice(j + 1, close).trim() || null;
      j = skipSpace(text, close + 1);
    }
  }
  const unit = readUnit(text, j);
  const rest = dropLeadingOf(text.slice(unit ? unit.end : j));
  const quantity = toQuantity(term);
  if (quantity === null) return plain(rest);
  return { quantity, unit: unit ? unit.unit : 'pieces', name: rest, note };
}

export function parseIngredientLine(line: string): ParsedLine {
  const text = line.slice(0, MAX_LINE_LENGTH).replace(/⁄/g, '/').trim();
  if (text === '') return plain('');
  const first = text.charAt(0);
  if (isDigit(first) || first === '.' || VULGAR[first]) return parseNumeric(text);
  const stripped = stripNoQuantityPhrases(text);
  if (stripped !== null) return plain(stripped);
  return parseArticle(text) ?? plain(text);
}


export interface QuickAddFields {
  readonly itemName: string;
  readonly quantity: number;
  readonly unit: string;
}

/** Split a one-line entry ("2 kg rice") for quick-add; null when it is just a name. */
export function quickAddFromLine(line: string): QuickAddFields | null {
  const parsed = parseIngredientLine(line);
  if (parsed.quantity === null || parsed.unit === null) return null;
  const itemName = parsed.name.slice(0, MAX_ITEM_NAME_LENGTH).trim();
  if (itemName === '') return null;
  const quantity = Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Number(parsed.quantity)));
  return { itemName, quantity, unit: parsed.unit };
}
