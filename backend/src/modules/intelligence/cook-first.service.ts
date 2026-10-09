/**
 * Cook-this-first service (INT-05): DB reads + pure ranking. No AI calls.
 * Read caps: 500 recipes (also the includeAll bound), 2000 pantry rows.
 */

import { prisma } from '../../config/database.config';
import { RecipeResponse } from '../../types/recipe.types';
import { toRecipeResponse } from '../recipe/recipe.format';
import { canonicalName } from './canonical';
import { rankCookFirst } from './cook-first';
import { resolveStaples } from './staples';

const RECIPE_READ_CAP = 500;
const PANTRY_READ_CAP = 2000;
const EXPIRING_WINDOW_DAYS = 7;
const MS_PER_DAY = 86_400_000;

export interface CookFirstItem {
  readonly recipe: RecipeResponse;
  readonly score: number;
  readonly usesExpiring: ReadonlyArray<{ readonly name: string; readonly daysLeft: number }>;
  readonly coveragePercent: number;
}

const extractNames = (list: unknown): string[] =>
  Array.isArray(list)
    ? list.flatMap((entry) => {
        const name = (entry as { ingredientName?: unknown } | null)?.ingredientName;
        return typeof name === 'string' && name.trim() !== '' ? [name] : [];
      })
    : [];

const utcDay = (d: Date): number =>
  Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / MS_PER_DAY);

export async function getCookFirst(
  userId: string,
  opts: { limit: number; today: Date; includeAll: boolean }
): Promise<{ items: CookFirstItem[]; expiringCount: number }> {
  const [recipes, pantry, prefs] = await Promise.all([
    prisma.recipe.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: RECIPE_READ_CAP,
    }),
    prisma.pantryItem.findMany({
      where: { userId, deletedAt: null },
      select: { ingredientName: true, expiryDate: true },
      take: PANTRY_READ_CAP,
    }),
    prisma.userPreference.findUnique({ where: { userId }, select: { stapleNames: true } }),
  ]);

  const ranked = rankCookFirst({
    recipes: recipes.map((r) => ({
      id: r.id,
      title: r.title,
      totalTimeMinutes: r.prepTimeMinutes + r.cookTimeMinutes,
      ingredientNames: extractNames(r.ingredientsList),
    })),
    pantry,
    staples: resolveStaples(prefs?.stapleNames),
    today: opts.today,
    limit: opts.limit,
    includeAll: opts.includeAll,
  });

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const items = ranked.flatMap((r): CookFirstItem[] => {
    const recipe = byId.get(r.id);
    return recipe
      ? [
          {
            recipe: toRecipeResponse(recipe),
            score: r.score,
            usesExpiring: r.usesExpiring,
            coveragePercent: r.coveragePercent,
          },
        ]
      : [];
  });

  const todayNum = utcDay(opts.today);
  const expiring = new Set<string>();
  for (const lot of pantry) {
    if (!lot.expiryDate) continue;
    const left = utcDay(lot.expiryDate) - todayNum;
    if (left >= 0 && left <= EXPIRING_WINDOW_DAYS) expiring.add(canonicalName(lot.ingredientName));
  }
  expiring.delete('');
  return { items, expiringCount: expiring.size };
}
