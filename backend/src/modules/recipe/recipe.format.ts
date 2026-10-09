/**
 * Recipe response formatter shared by RecipeService and cook-first.
 */

import { Recipe } from '@prisma/client';
import { RecipeIngredient, RecipeResponse } from '../../types/recipe.types';

export function toRecipeResponse(recipe: Recipe): RecipeResponse {
  return {
    id: recipe.id,
    userId: recipe.userId,
    name: recipe.title,
    description: recipe.description,
    category: recipe.category,
    difficulty: recipe.difficulty,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    totalTimeMinutes: recipe.prepTimeMinutes + recipe.cookTimeMinutes,
    servings: recipe.servings,
    ingredients: recipe.ingredientsList as unknown as RecipeIngredient[],
    instructions: recipe.instructions,
    imageUrl: recipe.imageUrl,
    tags: recipe.tags,
    dietaryRestrictions: recipe.dietaryRestrictions,
    isPublic: recipe.isPublic,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  } as RecipeResponse;
}
