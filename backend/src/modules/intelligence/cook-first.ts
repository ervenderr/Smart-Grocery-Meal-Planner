/**
 * Cook-this-first ranking (INT-05): pure and deterministic, no clock, no AI.
 * Recipes score by how many soon-to-expire (0-7 days) pantry items they use.
 */

import { canonicalName } from './canonical';

export const URGENCY_WEIGHTS = { soon: 5, near: 3, week: 1 } as const;

const MS_PER_DAY = 86_400_000;
const MAX_DAYS_AHEAD = 7;

export interface CookFirstRecipeInput {
  readonly id: string;
  readonly title: string;
  readonly totalTimeMinutes: number;
  readonly ingredientNames: readonly string[];
}

export interface CookFirstPantryInput {
  readonly ingredientName: string;
  readonly expiryDate: Date | null;
}

export interface CookFirstRanked {
  readonly id: string;
  readonly score: number;
  readonly usesExpiring: ReadonlyArray<{ readonly name: string; readonly daysLeft: number }>;
  readonly coveragePercent: number;
}

interface Scored extends CookFirstRanked {
  readonly title: string;
  readonly totalTimeMinutes: number;
}

const dayNumber = (d: Date): number =>
  Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / MS_PER_DAY);

const weightFor = (daysLeft: number): number => {
  if (daysLeft <= 1) return URGENCY_WEIGHTS.soon;
  if (daysLeft <= 3) return URGENCY_WEIGHTS.near;
  return daysLeft <= MAX_DAYS_AHEAD ? URGENCY_WEIGHTS.week : 0;
};

function indexPantry(pantry: readonly CookFirstPantryInput[], today: Date) {
  const todayNum = dayNumber(today);
  const expiring = new Map<string, number>();
  const stock = new Set<string>();
  for (const lot of pantry) {
    const name = canonicalName(lot.ingredientName);
    if (name === '') continue;
    let daysLeft: number | null = null;
    if (lot.expiryDate !== null) {
      daysLeft = dayNumber(lot.expiryDate) - todayNum;
      if (daysLeft < 0) continue; // expired: neither stock nor expiring
    }
    stock.add(name);
    if (daysLeft !== null && daysLeft <= MAX_DAYS_AHEAD) {
      const prev = expiring.get(name);
      expiring.set(name, prev === undefined ? daysLeft : Math.min(prev, daysLeft));
    }
  }
  return { expiring, stock };
}

function scoreRecipe(
  recipe: CookFirstRecipeInput,
  expiring: ReadonlyMap<string, number>,
  stock: ReadonlySet<string>,
  staples: ReadonlySet<string>
): Scored {
  const names = new Set(recipe.ingredientNames.map(canonicalName).filter((n) => n !== ''));
  const uses: Array<{ name: string; daysLeft: number }> = [];
  let covered = 0;
  let score = 0;
  for (const name of names) {
    const daysLeft = expiring.get(name);
    if (daysLeft !== undefined) {
      uses.push({ name, daysLeft });
      score += weightFor(daysLeft);
    }
    if (stock.has(name) || staples.has(name)) covered += 1;
  }
  uses.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));
  return {
    id: recipe.id,
    title: recipe.title,
    totalTimeMinutes: recipe.totalTimeMinutes,
    score,
    usesExpiring: uses,
    coveragePercent: names.size === 0 ? 0 : Math.round((100 * covered) / names.size),
  };
}

const compare = (a: Scored, b: Scored): number => {
  const titleA = a.title.toLowerCase();
  const titleB = b.title.toLowerCase();
  return (
    b.score - a.score ||
    b.coveragePercent - a.coveragePercent ||
    a.totalTimeMinutes - b.totalTimeMinutes ||
    (titleA < titleB ? -1 : titleA > titleB ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
};

export function rankCookFirst(args: {
  recipes: readonly CookFirstRecipeInput[];
  pantry: readonly CookFirstPantryInput[];
  staples: ReadonlySet<string>;
  today: Date;
  limit: number;
  includeAll: boolean;
}): CookFirstRanked[] {
  const { expiring, stock } = indexPantry(args.pantry, args.today);
  const scored = args.recipes
    .map((r) => scoreRecipe(r, expiring, stock, args.staples))
    .sort(compare);
  const selected = args.includeAll
    ? scored
    : scored.filter((s) => s.score > 0).slice(0, args.limit);
  return selected.map(({ id, score, usesExpiring, coveragePercent }) => ({
    id,
    score,
    usesExpiring,
    coveragePercent,
  }));
}
