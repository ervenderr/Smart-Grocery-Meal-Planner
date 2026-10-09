/**
 * Resolves what is being cooked: a recipe directly, or a planned meal (06-08).
 */

import { prisma } from '../../config/database.config';
import { AppError } from '../../middleware/errorHandler';
import { COOK_ERROR_CODES } from './cook.constants';

export interface CookTargetInput {
  readonly recipeId?: string;
  readonly mealPlanItemId?: string;
}

export interface CookRecipe {
  readonly id: string;
  readonly title: string;
  readonly servings: number;
  readonly ingredientsList: unknown;
}

export interface CookTarget {
  readonly recipe: CookRecipe;
  readonly defaultServings: number;
  readonly mealPlanItem: { readonly id: string; readonly cookedAt: Date | null } | null;
}

const RECIPE_SELECT = { id: true, title: true, servings: true, ingredientsList: true } as const;

export const recipeNotFound = (): AppError =>
  new AppError('Recipe not found', 404, true, { code: COOK_ERROR_CODES.RECIPE_NOT_FOUND });

export const mealNotFound = (): AppError =>
  new AppError('Meal not found', 404, true, { code: COOK_ERROR_CODES.MEAL_NOT_FOUND });

export const alreadyCooked = (): AppError =>
  new AppError('This meal is already marked as cooked.', 409, true, {
    code: COOK_ERROR_CODES.ALREADY_COOKED,
  });

async function resolveRecipe(userId: string, recipeId: string): Promise<CookTarget> {
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, OR: [{ userId }, { isPublic: true }], deletedAt: null },
    select: RECIPE_SELECT,
  });
  if (!recipe) throw recipeNotFound();
  return { recipe, defaultServings: recipe.servings, mealPlanItem: null };
}

async function resolveMeal(userId: string, mealPlanItemId: string): Promise<CookTarget> {
  const item = await prisma.mealPlanItem.findFirst({
    where: { id: mealPlanItemId, mealPlan: { userId, deletedAt: null } },
    select: {
      id: true,
      servings: true,
      cookedAt: true,
      recipe: { select: { ...RECIPE_SELECT, deletedAt: true } },
    },
  });
  if (!item) throw mealNotFound();
  if (!item.recipe || item.recipe.deletedAt) throw recipeNotFound();
  const { deletedAt: _deletedAt, ...recipe } = item.recipe;
  return {
    recipe,
    defaultServings: item.servings,
    mealPlanItem: { id: item.id, cookedAt: item.cookedAt },
  };
}

export function resolveCookTarget(userId: string, input: CookTargetInput): Promise<CookTarget> {
  if (input.mealPlanItemId) return resolveMeal(userId, input.mealPlanItemId);
  if (input.recipeId) return resolveRecipe(userId, input.recipeId);
  throw new AppError('recipeId or mealPlanItemId is required', 400, true, {
    code: 'VALIDATION_ERROR',
  });
}
