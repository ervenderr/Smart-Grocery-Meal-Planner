/**
 * Client port of the server unit registry (backend/src/modules/intelligence/units.ts).
 * Plain numbers (no Decimal). Parity is locked by backend/tests/fixtures/unit-convert-cases.json.
 * Families: mass (base g), volume (base ml), count (never convertible).
 */

import type { ResolvedUnit } from './types';

interface RegistryEntry {
  readonly family: 'mass' | 'volume';
  readonly factor: number;
  readonly system: 'metric' | 'us';
}

const REGISTRY: Readonly<Record<string, RegistryEntry>> = Object.freeze({
  grams: { family: 'mass', factor: 1, system: 'metric' },
  kg: { family: 'mass', factor: 1000, system: 'metric' },
  oz: { family: 'mass', factor: 28.349523125, system: 'us' },
  lbs: { family: 'mass', factor: 453.59237, system: 'us' },
  ml: { family: 'volume', factor: 1, system: 'metric' },
  liters: { family: 'volume', factor: 1000, system: 'metric' },
  tsp: { family: 'volume', factor: 4.92892159375, system: 'us' },
  tbsp: { family: 'volume', factor: 14.78676478125, system: 'us' },
  fl_oz: { family: 'volume', factor: 29.5735295625, system: 'us' },
  cups: { family: 'volume', factor: 236.5882365, system: 'us' },
});

const ALIASES: Readonly<Record<string, string>> = Object.freeze({
  g: 'grams', gram: 'grams', grams: 'grams', gr: 'grams',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lbs', lbs: 'lbs', pound: 'lbs', pounds: 'lbs',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'liters', liter: 'liters', liters: 'liters', litre: 'liters', litres: 'liters',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  'fl oz': 'fl_oz', floz: 'fl_oz', fl_oz: 'fl_oz', 'fluid ounce': 'fl_oz', 'fluid ounces': 'fl_oz',
  cup: 'cups', cups: 'cups',
});

const PIECES = 'pieces';
const PIECE_WORDS: ReadonlySet<string> = new Set([
  '', 'piece', 'pieces', 'pc', 'pcs', 'item', 'items',
]);

/** Relative epsilon for have >= need comparisons. */
export const UNIT_EPSILON = 1e-6;

const has = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

const normalizeKey = (raw: string): string =>
  raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

/** Conservative depluralization of a count unit (bunches->bunch, cloves->clove). */
function depluralize(word: string): string {
  if (/(ss|us|is)$/.test(word)) return word;
  if (/(ch|sh|x)es$/.test(word) && word.length - 2 >= 3) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function entryToResolved(key: string): ResolvedUnit {
  const entry = REGISTRY[key];
  return Object.freeze({
    family: entry.family,
    unitKey: key,
    label: key,
    factor: entry.factor,
    system: entry.system,
  });
}

function resolveCount(raw: string): ResolvedUnit {
  const lowered = normalizeKey(raw);
  const unitKey = PIECE_WORDS.has(lowered) ? PIECES : depluralize(lowered);
  return Object.freeze({
    family: 'count' as const,
    unitKey,
    label: unitKey,
    factor: null,
    system: null,
  });
}

export function resolveUnit(raw: string | null | undefined): ResolvedUnit {
  const text = typeof raw === 'string' ? raw : '';
  const alias = has(ALIASES, normalizeKey(text)) ? ALIASES[normalizeKey(text)] : undefined;
  if (alias && has(REGISTRY, alias)) return entryToResolved(alias);
  return resolveCount(text);
}

export function familyKey(u: ResolvedUnit): string {
  return u.family === 'count' ? `count:${u.unitKey}` : u.family;
}

export function toBase(qty: number, u: ResolvedUnit): number {
  return u.factor === null ? qty : qty * u.factor;
}

export function isConvertibleUnitKey(unitKey: string): boolean {
  return has(REGISTRY, unitKey);
}

export function fromBase(base: number, unitKey: string): number {
  return has(REGISTRY, unitKey) ? base / REGISTRY[unitKey].factor : base;
}
