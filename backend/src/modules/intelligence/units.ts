/**
 * Unit registry, exact family conversion and display ladder.
 *
 * Families: mass (base g), volume (base ml), count (never convertible).
 * All factors are exact decimal strings; conversion never touches JS floats.
 */

import { coerceUnit } from '../shopping/shopping.units';
import { D, Dec } from './quantity';

export type UnitFamily = 'mass' | 'volume' | 'count';
export type UnitSystem = 'metric' | 'us';

export interface ResolvedUnit {
  readonly family: UnitFamily;
  readonly unitKey: string;
  readonly label: string;
  readonly factor: Dec | null;
  readonly system: UnitSystem | null;
}

interface RegistryEntry {
  readonly family: 'mass' | 'volume';
  readonly factor: string;
  readonly system: UnitSystem;
}

const REGISTRY: Readonly<Record<string, RegistryEntry>> = Object.freeze({
  grams: { family: 'mass', factor: '1', system: 'metric' },
  kg: { family: 'mass', factor: '1000', system: 'metric' },
  oz: { family: 'mass', factor: '28.349523125', system: 'us' },
  lbs: { family: 'mass', factor: '453.59237', system: 'us' },
  ml: { family: 'volume', factor: '1', system: 'metric' },
  liters: { family: 'volume', factor: '1000', system: 'metric' },
  tsp: { family: 'volume', factor: '4.92892159375', system: 'us' },
  tbsp: { family: 'volume', factor: '14.78676478125', system: 'us' },
  fl_oz: { family: 'volume', factor: '29.5735295625', system: 'us' },
  cups: { family: 'volume', factor: '236.5882365', system: 'us' },
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

const normalizeKey = (raw: string): string =>
  raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

/**
 * Conservative depluralization of a count unit, matching canonical.ts:
 * "bunches"->"bunch", "pinches"->"pinch", "cloves"->"clove", "cans"->"can".
 * Keeps >= 3 chars and never strips "ss"/"us"/"is" endings.
 */
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
    factor: new D(entry.factor),
    system: entry.system,
  });
}

function resolveCount(raw: string): ResolvedUnit {
  const label = coerceUnit(raw);
  const lowered = normalizeKey(label);
  const unitKey = PIECE_WORDS.has(lowered) ? PIECES : depluralize(lowered);
  return Object.freeze({
    family: 'count' as const,
    unitKey,
    label: unitKey === PIECES ? PIECES : label,
    factor: null,
    system: null,
  });
}

export function resolveUnit(raw: string | null | undefined): ResolvedUnit {
  const text = typeof raw === 'string' ? raw : '';
  const alias = ALIASES[normalizeKey(text)];
  if (alias && Object.prototype.hasOwnProperty.call(REGISTRY, alias)) {
    return entryToResolved(alias);
  }
  return resolveCount(text);
}

export function familyKey(u: ResolvedUnit): string {
  return u.family === 'count' ? `count:${u.unitKey}` : u.family;
}

export function toBase(qty: Dec, u: ResolvedUnit): Dec {
  return u.factor ? qty.times(u.factor) : qty;
}

export function fromBase(base: Dec, unitKey: string): Dec {
  const entry = Object.prototype.hasOwnProperty.call(REGISTRY, unitKey)
    ? REGISTRY[unitKey]
    : null;
  return entry ? base.div(entry.factor) : base;
}

interface Rung {
  readonly unit: string;
  /** Minimum amount in the rung's own unit before it is chosen. */
  readonly min: string;
}

/**
 * Display-unit ladder (single place to change it). Rungs are ordered smallest
 * to largest; the largest rung whose threshold is met (in its own unit) wins.
 *  - metric mass:   grams -> kg at >= 1000 g
 *  - US mass:       oz -> lbs at >= 1 lb
 *  - metric volume: ml -> liters at >= 1000 ml
 *  - US volume:     tsp -> tbsp at >= 1 tbsp -> cups at >= 1/4 cup
 *  - fl_oz only:    fl_oz -> cups at >= 1 cup (when every input is fl_oz)
 * System is the majority of the input units' systems (tie -> metric).
 */
const LADDERS: Readonly<Record<string, readonly Rung[]>> = Object.freeze({
  'mass:metric': [{ unit: 'grams', min: '0' }, { unit: 'kg', min: '1' }],
  'mass:us': [{ unit: 'oz', min: '0' }, { unit: 'lbs', min: '1' }],
  'volume:metric': [{ unit: 'ml', min: '0' }, { unit: 'liters', min: '1' }],
  'volume:us': [
    { unit: 'tsp', min: '0' },
    { unit: 'tbsp', min: '1' },
    { unit: 'cups', min: '0.25' },
  ],
  'volume:fl_oz': [{ unit: 'fl_oz', min: '0' }, { unit: 'cups', min: '1' }],
});

function pickSystem(inputUnitKeys: readonly string[]): UnitSystem {
  let metric = 0;
  let us = 0;
  for (const key of inputUnitKeys) {
    const entry = Object.prototype.hasOwnProperty.call(REGISTRY, key) ? REGISTRY[key] : null;
    if (entry?.system === 'metric') metric += 1;
    if (entry?.system === 'us') us += 1;
  }
  return us > metric ? 'us' : 'metric';
}

function ladderFor(family: 'mass' | 'volume', inputs: readonly string[]): readonly Rung[] {
  if (family === 'volume' && inputs.length > 0 && inputs.every((k) => k === 'fl_oz')) {
    return LADDERS['volume:fl_oz'];
  }
  return LADDERS[`${family}:${pickSystem(inputs)}`];
}

export function toDisplay(args: {
  family: UnitFamily;
  countLabel: string;
  baseTotal: Dec;
  inputUnitKeys: readonly string[];
}): { unit: string; quantity: Dec } {
  const { family, countLabel, baseTotal, inputUnitKeys } = args;
  if (family === 'count') return { unit: countLabel, quantity: baseTotal };

  const ladder = ladderFor(family, inputUnitKeys);
  let chosen = 0;
  ladder.forEach((rung, i) => {
    if (fromBase(baseTotal, rung.unit).gte(rung.min)) chosen = i;
  });
  // Step down while a positive value would round to 0.00 in the chosen unit.
  while (
    chosen > 0 &&
    baseTotal.gt(0) &&
    fromBase(baseTotal, ladder[chosen].unit).toDecimalPlaces(2).isZero()
  ) {
    chosen -= 1;
  }
  const unit = ladder[chosen].unit;
  return { unit, quantity: fromBase(baseTotal, unit) };
}
