/**
 * Meal Plan Service
 *
 * Business logic for meal planning functionality.
 */

import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateMealPlanRequest,
  UpdateMealPlanRequest,
  MealPlanResponse,
  GetMealPlansQuery,
  PaginatedMealPlanResponse,
  MealPlanStats,
  ShoppingListFromMealPlan,
  MealPlanItemResponse,
  MealPlanItemInput,
} from '../../types/mealplan.types';
import { RecipeIngredient } from '../../types/recipe.types';

export class MealPlanService {
  /**
   * Create a new meal plan
   */
  async createMealPlan(
    userId: string,
    data: CreateMealPlanRequest
  ): Promise<MealPlanResponse> {
    const { name, startDate, endDate, notes, meals } = data;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    if (start > end) {
      throw new AppError('Start date must be before end date', 400);
    }

    // Validate meals
    if (!meals || meals.length === 0) {
      throw new AppError('Meal plan must have at least one meal', 400);
    }

    // Check if all recipes exist
    const recipeIds = meals.map((m) => m.recipeId);
    const recipes = await prisma.recipe.findMany({
      where: {
        id: { in: recipeIds },
        OR: [{ userId }, { isPublic: true }],
        deletedAt: null,
      },
    });

    if (recipes.length !== recipeIds.length) {
      throw new AppError('One or more recipes not found', 404);
    }

    // Calculate total cost and calories
    const { totalCostCents, totalCalories } = await this.calculateMealPlanTotals(
      meals,
      recipes
    );

    // Create meal plan with items
    const mealPlan = await prisma.mealPlan.create({
      data: {
        userId,
        name: name.trim(),
        startDate: start,
        endDate: end,
        notes: notes?.trim() || null,
        totalCostCents,
        totalCalories,
        mealPlanItems: {
          create: meals.map((meal) => {
            const recipe = recipes.find((r) => r.id === meal.recipeId)!;
            const servings = meal.servings || 1;

            return {
              recipeId: meal.recipeId,
              dayOfWeek: meal.dayOfWeek,
              mealType: meal.mealType,
              servings,
              costCents: recipe.estimatedTotalCostCents
                ? Math.round(
                    (recipe.estimatedTotalCostCents / recipe.servings) * servings
                  )
                : null,
              calories: recipe.caloriesPerServing
                ? recipe.caloriesPerServing * servings
                : null,
            };
          }),
        },
      },
      include: {
        mealPlanItems: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                prepTimeMinutes: true,
                cookTimeMinutes: true,
              },
            },
          },
        },
      },
    });

    logger.info('Meal plan created', {
      service: 'kitcha-api',
      userId,
      mealPlanId: mealPlan.id,
      name: mealPlan.name,
    });

    return this.formatMealPlan(mealPlan);
  }

  /**
   * Get all meal plans for a user with filtering and pagination
   */
  async getMealPlans(
    userId: string,
    query: GetMealPlansQuery
  ): Promise<PaginatedMealPlanResponse> {
    const {
      startDate,
      endDate,
      isFavorite,
      sortBy = 'startDate',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
    } = query;

    // Build where clause
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (startDate) {
      where.startDate = { gte: new Date(startDate) };
    }

    if (endDate) {
      where.endDate = { lte: new Date(endDate) };
    }

    if (isFavorite !== undefined) {
      where.isFavorite = isFavorite;
    }

    // Get total count
    const total = await prisma.mealPlan.count({ where });

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else if (sortBy === 'totalCost') {
      orderBy.totalCostCents = sortOrder;
    } else if (sortBy === 'startDate') {
      orderBy.startDate = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Get meal plans
    const mealPlans = await prisma.mealPlan.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        mealPlanItems: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                prepTimeMinutes: true,
                cookTimeMinutes: true,
              },
            },
          },
        },
      },
    });

    return {
      items: mealPlans.map((plan) => this.formatMealPlan(plan)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get a single meal plan by ID
   */
  async getMealPlanById(userId: string, mealPlanId: string): Promise<MealPlanResponse> {
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        id: mealPlanId,
        userId,
        deletedAt: null,
      },
      include: {
        mealPlanItems: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                prepTimeMinutes: true,
                cookTimeMinutes: true,
              },
            },
          },
        },
      },
    });

    if (!mealPlan) {
      throw new AppError('Meal plan not found', 404);
    }

    return this.formatMealPlan(mealPlan);
  }

  /**
   * Update a meal plan
   */
  async updateMealPlan(
    userId: string,
    mealPlanId: string,
    data: UpdateMealPlanRequest
  ): Promise<MealPlanResponse> {
    // Check if meal plan exists and belongs to user
    const existingMealPlan = await prisma.mealPlan.findFirst({
      where: {
        id: mealPlanId,
        userId,
        deletedAt: null,
      },
    });

    if (!existingMealPlan) {
      throw new AppError('Meal plan not found', 404);
    }

    // Validate dates if provided
    if (data.startDate || data.endDate) {
      const start = data.startDate
        ? new Date(data.startDate)
        : existingMealPlan.startDate;
      const end = data.endDate ? new Date(data.endDate) : existingMealPlan.endDate;

      if (
        (data.startDate && isNaN(start.getTime())) ||
        (data.endDate && isNaN(end.getTime()))
      ) {
        throw new AppError('Invalid date format', 400);
      }

      if (start > end) {
        throw new AppError('Start date must be before end date', 400);
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.startDate !== undefined) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate !== undefined) {
      updateData.endDate = new Date(data.endDate);
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes?.trim() || null;
    }
    if (data.isFavorite !== undefined) {
      updateData.isFavorite = data.isFavorite;
    }

    // If meals are being updated, delete old ones and create new ones
    if (data.meals !== undefined) {
      if (data.meals.length === 0) {
        throw new AppError('Meal plan must have at least one meal', 400);
      }

      // Check if all recipes exist
      const recipeIds = data.meals.map((m) => m.recipeId);
      const recipes = await prisma.recipe.findMany({
        where: {
          id: { in: recipeIds },
          OR: [{ userId }, { isPublic: true }],
          deletedAt: null,
        },
      });

      if (recipes.length !== recipeIds.length) {
        throw new AppError('One or more recipes not found', 404);
      }

      // Calculate new totals
      const { totalCostCents, totalCalories } = await this.calculateMealPlanTotals(
        data.meals,
        recipes
      );

      updateData.totalCostCents = totalCostCents;
      updateData.totalCalories = totalCalories;

      // Delete existing meal plan items and create new ones
      await prisma.mealPlanItem.deleteMany({
        where: { mealPlanId },
      });

      updateData.mealPlanItems = {
        create: data.meals.map((meal) => {
          const recipe = recipes.find((r) => r.id === meal.recipeId)!;
          const servings = meal.servings || 1;

          return {
            recipeId: meal.recipeId,
            dayOfWeek: meal.dayOfWeek,
            mealType: meal.mealType,
            servings,
            costCents: recipe.estimatedTotalCostCents
              ? Math.round(
                  (recipe.estimatedTotalCostCents / recipe.servings) * servings
                )
              : null,
            calories: recipe.caloriesPerServing
              ? recipe.caloriesPerServing * servings
              : null,
          };
        }),
      };
    }

    // Update meal plan
    const mealPlan = await prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: updateData,
      include: {
        mealPlanItems: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                prepTimeMinutes: true,
                cookTimeMinutes: true,
              },
            },
          },
        },
      },
    });

    logger.info('Meal plan updated', {
      service: 'kitcha-api',
      userId,
      mealPlanId,
    });

    return this.formatMealPlan(mealPlan);
  }

  /**
   * Delete a meal plan (soft delete)
   */
  async deleteMealPlan(userId: string, mealPlanId: string): Promise<void> {
    // Check if meal plan exists and belongs to user
    const existingMealPlan = await prisma.mealPlan.findFirst({
      where: {
        id: mealPlanId,
        userId,
        deletedAt: null,
      },
    });

    if (!existingMealPlan) {
      throw new AppError('Meal plan not found', 404);
    }

    // Soft delete
    await prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: { deletedAt: new Date() },
    });

    logger.info('Meal plan deleted', {
      service: 'kitcha-api',
      userId,
      mealPlanId,
    });
  }

  /**
   * Get meal plan statistics
   */
  async getStats(userId: string): Promise<MealPlanStats> {
    const mealPlans = await prisma.mealPlan.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        mealPlanItems: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    const stats: MealPlanStats = {
      totalMealPlans: mealPlans.length,
      averageCostCents: 0,
      averageCalories: 0,
      mealsByType: {},
      favoriteRecipes: [],
    };

    if (mealPlans.length === 0) {
      return stats;
    }

    // Calculate averages
    const plansWithCost = mealPlans.filter((p) => p.totalCostCents !== null);
    if (plansWithCost.length > 0) {
      const totalCost = plansWithCost.reduce((sum, p) => sum + (p.totalCostCents || 0), 0);
      stats.averageCostCents = Math.round(totalCost / plansWithCost.length);
    }

    const plansWithCalories = mealPlans.filter((p) => p.totalCalories !== null);
    if (plansWithCalories.length > 0) {
      const totalCalories = plansWithCalories.reduce(
        (sum, p) => sum + (p.totalCalories || 0),
        0
      );
      stats.averageCalories = Math.round(totalCalories / plansWithCalories.length);
    }

    // Count meals by type
    const recipeUsageMap = new Map<string, { name: string; count: number }>();

    mealPlans.forEach((plan) => {
      plan.mealPlanItems.forEach((item) => {
        // Count by meal type
        stats.mealsByType[item.mealType] = (stats.mealsByType[item.mealType] || 0) + 1;

        // Count recipe usage
        const existing = recipeUsageMap.get(item.recipeId);
        if (existing) {
          existing.count++;
        } else {
          recipeUsageMap.set(item.recipeId, {
            name: item.recipe.title,
            count: 1,
          });
        }
      });
    });

    // Get top 10 favorite recipes
    stats.favoriteRecipes = Array.from(recipeUsageMap.entries())
      .map(([recipeId, data]) => ({
        recipeId,
        recipeName: data.name,
        usageCount: data.count,
      }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    return stats;
  }

  /**
   * Generate shopping list from meal plan
   */
  async generateShoppingList(
    userId: string,
    mealPlanId: string
  ): Promise<ShoppingListFromMealPlan> {
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        id: mealPlanId,
        userId,
        deletedAt: null,
      },
      include: {
        mealPlanItems: {
          include: {
            recipe: true,
          },
        },
      },
    });

    if (!mealPlan) {
      throw new AppError('Meal plan not found', 404);
    }

    // Aggregate ingredients across all recipes
    const ingredientMap = new Map<
      string,
      { quantity: number; unit: string; recipes: Set<string> }
    >();

    mealPlan.mealPlanItems.forEach((item) => {
      const recipe = item.recipe;
      const servingMultiplier = item.servings / recipe.servings;
      const ingredients = recipe.ingredientsList as any as RecipeIngredient[];

      ingredients.forEach((ingredient) => {
        const key = `${ingredient.ingredientName.toLowerCase()}:${ingredient.unit}`;
        const existing = ingredientMap.get(key);

        if (existing) {
          existing.quantity += ingredient.quantity * servingMultiplier;
          existing.recipes.add(recipe.title);
        } else {
          ingredientMap.set(key, {
            quantity: ingredient.quantity * servingMultiplier,
            unit: ingredient.unit,
            recipes: new Set([recipe.title]),
          });
        }
      });
    });

    // Convert to array
    const items = Array.from(ingredientMap.entries()).map(([key, data]) => {
      const ingredientName = key.split(':')[0];
      return {
        ingredientName,
        quantity: Math.round(data.quantity * 100) / 100, // Round to 2 decimal places
        unit: data.unit,
        recipes: Array.from(data.recipes),
      };
    });

    return {
      items,
      totalEstimatedCostCents: mealPlan.totalCostCents || undefined,
    };
  }

  /**
   * Calculate meal plan totals
   */
  private async calculateMealPlanTotals(
    meals: MealPlanItemInput[],
    recipes: any[]
  ): Promise<{ totalCostCents: number | null; totalCalories: number | null }> {
    let totalCostCents: number | null = 0;
    let totalCalories: number | null = 0;
    let hasAnyCost = false;
    let hasAnyCalories = false;

    meals.forEach((meal) => {
      const recipe = recipes.find((r) => r.id === meal.recipeId)!;
      const servings = meal.servings || 1;

      if (recipe.estimatedTotalCostCents) {
        totalCostCents! += Math.round(
          (recipe.estimatedTotalCostCents / recipe.servings) * servings
        );
        hasAnyCost = true;
      }

      if (recipe.caloriesPerServing) {
        totalCalories! += recipe.caloriesPerServing * servings;
        hasAnyCalories = true;
      }
    });

    return {
      totalCostCents: hasAnyCost ? totalCostCents : null,
      totalCalories: hasAnyCalories ? totalCalories : null,
    };
  }

  /**
   * Format meal plan for response
   */
  private formatMealPlan(mealPlan: any): MealPlanResponse {
    return {
      id: mealPlan.id,
      userId: mealPlan.userId,
      name: mealPlan.name,
      startDate: mealPlan.startDate.toISOString().split('T')[0],
      endDate: mealPlan.endDate.toISOString().split('T')[0],
      totalCostCents: mealPlan.totalCostCents,
      totalCalories: mealPlan.totalCalories,
      isFavorite: mealPlan.isFavorite,
      notes: mealPlan.notes,
      meals: mealPlan.mealPlanItems.map((item: any): MealPlanItemResponse => ({
        id: item.id,
        recipeId: item.recipeId,
        dayOfWeek: item.dayOfWeek,
        mealType: item.mealType,
        servings: item.servings,
        costCents: item.costCents,
        calories: item.calories,
        recipe: item.recipe
          ? {
              id: item.recipe.id,
              name: item.recipe.title,
              imageUrl: item.recipe.imageUrl,
              prepTimeMinutes: item.recipe.prepTimeMinutes,
              cookTimeMinutes: item.recipe.cookTimeMinutes,
            }
          : undefined,
      })),
      createdAt: mealPlan.createdAt.toISOString(),
      updatedAt: mealPlan.updatedAt.toISOString(),
    };
  }
}
