/**
 * Test-only helpers: a seeded PRNG and a synthetic recipe/pantry generator.
 * Never imported by production code (excluded from the determinism source scan).
 */
import rawTable from './data/substitutions.json';
import type { RulesPantryItem, RulesRecipe } from './types';

const VOCABULARY_SIZE = 300;
const MS_PER_DAY = 86_400_000;
const UNITS: readonly string[] = ['grams', 'kg', 'ml', 'liters', 'tsp', 'tbsp', 'cups', 'oz', 'lbs', 'pieces'];

/** Small deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeededDatasetOptions {
  readonly seed: number;
  readonly recipes: number;
  readonly pantry: number;
  /** YYYY-MM-DD */
  readonly today: string;
}

export interface SeededDataset {
  readonly recipes: readonly RulesRecipe[];
  readonly pantry: readonly RulesPantryItem[];
  readonly vocabulary: readonly string[];
}

const buildVocabulary = (): readonly string[] => {
  const real = (rawTable as { entries: ReadonlyArray<{ ingredient: string }> }).entries.map(
    (e) => e.ingredient,
  );
  const synthetic = Array.from(
    { length: Math.max(0, VOCABULARY_SIZE - real.length) },
    (_, i) => `test ingredient ${i}`,
  );
  return [...real, ...synthetic].slice(0, VOCABULARY_SIZE);
};

const shiftDay = (today: string, days: number): string =>
  new Date(Date.parse(`${today}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);

export function makeSeededDataset(options: SeededDatasetOptions): SeededDataset {
  const rand = mulberry32(options.seed);
  const vocabulary = buildVocabulary();
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const between = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));

  const recipes: RulesRecipe[] = Array.from({ length: options.recipes }, (_, i) => ({
    id: `recipe-${i}`,
    name: `Recipe ${i}`,
    totalTimeMinutes: between(5, 120),
    servings: between(1, 8),
    ingredients: Array.from({ length: between(6, 14) }, () => ({
      ingredientName: pick(vocabulary),
      quantity: between(1, 8) * 0.5,
      unit: pick(UNITS),
    })),
  }));

  const pantry: RulesPantryItem[] = Array.from({ length: options.pantry }, (_, i) => {
    const roll = rand();
    const expiryDate =
      roll < 0.05
        ? shiftDay(options.today, -between(1, 5))
        : roll < 0.35
          ? shiftDay(options.today, between(0, 7))
          : roll < 0.7
            ? shiftDay(options.today, between(8, 60))
            : null;
    return {
      id: `pantry-${i}`,
      ingredientName: pick(vocabulary),
      quantity: between(1, 20) * 0.5,
      unit: pick(UNITS),
      expiryDate,
    };
  });

  return Object.freeze({ recipes, pantry, vocabulary });
}
