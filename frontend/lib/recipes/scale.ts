import type { RecipeIngredient } from '@/types/recipe.types';

/** Scale ingredient quantities from one serving count to another. Pure. */
export function scaleIngredients(
  ingredients: readonly RecipeIngredient[],
  fromServings: number,
  toServings: number,
): RecipeIngredient[] {
  const valid =
    Number.isFinite(fromServings) &&
    Number.isFinite(toServings) &&
    fromServings > 0 &&
    toServings > 0;
  if (!valid) return ingredients.map((i) => ({ ...i }));
  const factor = toServings / fromServings;
  return ingredients.map((i) => ({
    ...i,
    quantity: Math.round(i.quantity * factor * 100) / 100,
  }));
}
