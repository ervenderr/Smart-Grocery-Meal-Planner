/**
 * Meal plan response formatting (extracted from mealplan.service.ts, 06-08).
 */

import type { MealPlanItemResponse, MealPlanResponse } from "../../types/mealplan.types";

export function formatMealPlan(mealPlan: any): MealPlanResponse {
  return {
    id: mealPlan.id,
    userId: mealPlan.userId,
    name: mealPlan.name,
    startDate: mealPlan.startDate.toISOString().split("T")[0],
    endDate: mealPlan.endDate.toISOString().split("T")[0],
    totalCostCents: mealPlan.totalCostCents,
    totalCalories: mealPlan.totalCalories,
    isFavorite: mealPlan.isFavorite,
    notes: mealPlan.notes,
    meals: mealPlan.mealPlanItems.map(
      (item: any): MealPlanItemResponse => ({
        id: item.id,
        recipeId: item.recipeId,
        dayOfWeek: item.dayOfWeek,
        mealType: item.mealType,
        servings: item.servings,
        costCents: item.costCents,
        calories: item.calories,
        cookedAt: item.cookedAt ? item.cookedAt.toISOString() : null,
        recipe: item.recipe
          ? {
              id: item.recipe.id,
              name: item.recipe.title,
              imageUrl: item.recipe.imageUrl,
              prepTimeMinutes: item.recipe.prepTimeMinutes,
              cookTimeMinutes: item.recipe.cookTimeMinutes,
            }
          : undefined,
      })
    ),
    createdAt: mealPlan.createdAt.toISOString(),
    updatedAt: mealPlan.updatedAt.toISOString(),
  };
}
