/**
 * Offline recipe ranking: quantity-aware pantry coverage, expiring-soon boost
 * and a missing-count penalty. Pure and deterministic: no clock, network or
 * storage reads ("today" is injected via the context).
 */
import { compileRestrictions, violatesCompiled } from './diet';
import { groupNeeds, resolveMatch } from './match';
import { buildPantryIndex } from './pantry-index';
import type { PantryIndex } from './pantry-index';
import type {
  ExpiringUse,
  IngredientMatch,
  RankResult,
  RankedRecipe,
  RulesContext,
  RulesPantryItem,
  RulesRecipe,
} from './types';

export const URGENCY_WEIGHTS = Object.freeze({ soon: 5, near: 3, week: 1 } as const);
export const EXPIRY_WINDOW_DAYS = 7;
export const EXPIRY_POINTS = 4;
export const MISSING_PENALTY = 6;
export const MAX_RECIPES = 500;

const weightFor = (daysLeft: number): number => {
  if (daysLeft <= 1) return URGENCY_WEIGHTS.soon;
  if (daysLeft <= 3) return URGENCY_WEIGHTS.near;
  return daysLeft <= EXPIRY_WINDOW_DAYS ? URGENCY_WEIGHTS.week : 0;
};

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

type Unranked = Omit<RankedRecipe, 'rank'>;

/** readyToCook first (empty recipes last), then score, coverage, time, name, id. */
function compareRanked(a: Unranked, b: Unranked): number {
  const hasA = a.totalCount > 0 ? 1 : 0;
  const hasB = b.totalCount > 0 ? 1 : 0;
  return (
    hasB - hasA ||
    Number(b.readyToCook) - Number(a.readyToCook) ||
    b.score - a.score ||
    b.coveragePercent - a.coveragePercent ||
    a.totalTimeMinutes - b.totalTimeMinutes ||
    cmp(a.name.toLowerCase(), b.name.toLowerCase()) ||
    cmp(a.recipeId, b.recipeId)
  );
}

function expiringOf(matches: readonly IngredientMatch[]): readonly ExpiringUse[] {
  const uses: ExpiringUse[] = [];
  for (const m of matches) {
    const usable = m.status === 'have' || m.status === 'partial' || m.status === 'unitMismatch';
    if (usable && m.daysLeft !== null && m.daysLeft <= EXPIRY_WINDOW_DAYS) {
      uses.push({ name: m.name, daysLeft: m.daysLeft });
    }
  }
  return uses.sort((a, b) => a.daysLeft - b.daysLeft || cmp(a.name, b.name));
}

function scoreRecipe(recipe: RulesRecipe, index: PantryIndex, ctx: RulesContext): Unranked {
  const groups = groupNeeds(recipe.ingredients);
  const have: IngredientMatch[] = [];
  const missing: IngredientMatch[] = [];
  let credit = 0;
  for (const group of groups) {
    const res = resolveMatch(group, index, ctx);
    credit += res.credit;
    (res.match.status === 'missing' || res.match.status === 'partial' ? missing : have).push(res.match);
  }
  const totalCount = groups.length;
  const coveragePercent = totalCount === 0 ? 0 : Math.round((100 * credit) / totalCount);
  const expiringUsed = expiringOf([...have, ...missing]);
  const expiryBoost = expiringUsed.reduce((sum, u) => sum + weightFor(u.daysLeft), 0);
  const missingCount = missing.length;
  return Object.freeze({
    recipeId: recipe.id,
    name: recipe.name,
    totalTimeMinutes: recipe.totalTimeMinutes,
    servings: recipe.servings,
    coveragePercent,
    totalCount,
    haveCount: have.length,
    missingCount,
    readyToCook: totalCount > 0 && missingCount === 0,
    expiryBoost,
    score: coveragePercent + expiryBoost * EXPIRY_POINTS - missingCount * MISSING_PENALTY,
    have: Object.freeze(have),
    missing: Object.freeze(missing),
    expiringUsed: Object.freeze(expiringUsed),
  });
}

export function rankRecipes(
  recipes: readonly RulesRecipe[],
  pantry: readonly RulesPantryItem[],
  ctx: RulesContext,
): RankResult {
  const index = buildPantryIndex(pantry, ctx.today);
  const considered = recipes.slice(0, MAX_RECIPES);
  const patterns =
    ctx.applyDiet && ctx.restrictions.length > 0 ? compileRestrictions(ctx.restrictions) : [];
  let hiddenByDiet = 0;
  let hiddenByReady = 0;
  const kept: Unranked[] = [];
  for (const recipe of considered) {
    if (patterns.length > 0) {
      const texts = [recipe.name, ...recipe.ingredients.map((i) => i.ingredientName)];
      if (violatesCompiled(texts, patterns)) {
        hiddenByDiet += 1;
        continue;
      }
    }
    const scored = scoreRecipe(recipe, index, ctx);
    if (ctx.onlyReady && !scored.readyToCook) {
      hiddenByReady += 1;
      continue;
    }
    kept.push(scored);
  }
  const items = [...kept]
    .sort(compareRanked)
    .map((r, i) => Object.freeze({ ...r, rank: i + 1 }) as RankedRecipe);
  return Object.freeze({
    items: Object.freeze(items),
    totalRecipes: considered.length,
    hiddenByDiet,
    hiddenByReady,
    recipesCapped: recipes.length > MAX_RECIPES,
    pantryCapped: index.capped,
  });
}
