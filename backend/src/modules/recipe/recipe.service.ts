/**
 * Recipe Service
 *
 * Business logic for recipe management.
 */

import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateRecipeRequest,
  UpdateRecipeRequest,
  RecipeResponse,
  GetRecipesQuery,
  PaginatedRecipeResponse,
  RecipeStats,
  RecipeIngredient,
} from '../../types/recipe.types';

export class RecipeService {
  /**
   * Create a new recipe
   */
  async createRecipe(
    userId: string,
    data: CreateRecipeRequest
  ): Promise<RecipeResponse> {
    const {
      name: title,
      description,
      category,
      difficulty,
      prepTimeMinutes,
      cookTimeMinutes,
      servings,
      ingredients: ingredientsList,
      instructions,
      imageUrl,
      tags,
      dietaryRestrictions,
      isPublic = false,
    } = data;

    // Validate time values
    if (prepTimeMinutes < 0 || cookTimeMinutes < 0) {
      throw new AppError('Time values must be non-negative', 400);
    }

    // Validate servings
    if (servings <= 0) {
      throw new AppError('Servings must be greater than 0', 400);
    }

    // Validate ingredients
    if (!ingredientsList || ingredientsList.length === 0) {
      throw new AppError('Recipe must have at least one ingredient', 400);
    }

    // Validate instructions
    if (!instructions || instructions.length === 0) {
      throw new AppError('Recipe must have at least one instruction', 400);
    }

    // Create the recipe
    const recipe = await prisma.recipe.create({
      data: {
        userId,
        title: title.trim(),
        description: description?.trim() || null,
        category,
        difficulty,
        prepTimeMinutes,
        cookTimeMinutes,
        servings,
        ingredientsList: ingredientsList as any, // JSON field
        instructions,
        imageUrl,
        tags: tags || [],
        dietaryRestrictions: dietaryRestrictions || [],
        isPublic,
      },
    });

    logger.info('Recipe created', {
      service: 'smart-grocery-api',
      userId,
      recipeId: recipe.id,
      title: recipe.title,
    });

    return this.formatRecipe(recipe);
  }

  /**
   * Get all recipes for a user with filtering and pagination
   */
  async getRecipes(
    userId: string,
    query: GetRecipesQuery
  ): Promise<PaginatedRecipeResponse> {
    const {
      category,
      difficulty,
      dietaryRestriction,
      maxPrepTime,
      maxCookTime,
      maxTotalTime,
      search,
      tags,
      includePublic = false,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
    } = query;

    // Build where clause
    const where: any = {
      deletedAt: null,
    };

    // Filter by user's recipes or public recipes
    if (includePublic) {
      where.OR = [{ userId }, { isPublic: true }];
    } else {
      where.userId = userId;
    }

    if (category) {
      where.category = category;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (maxPrepTime) {
      where.prepTimeMinutes = { lte: maxPrepTime };
    }

    if (maxCookTime) {
      where.cookTimeMinutes = { lte: maxCookTime };
    }

    // Note: maxTotalTime filtering will be done after fetching
    // since totalTime is a computed field

    // Handle dietary restriction filtering
    if (dietaryRestriction) {
      where.dietaryRestrictions = {
        has: dietaryRestriction,
      };
    }

    // Handle tags filtering
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim());
      where.tags = {
        hasEvery: tagList,
      };
    }

    // Get total count
    const total = await prisma.recipe.count({ where });

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'name') {
      orderBy.title = sortOrder;
    } else if (sortBy === 'prepTime') {
      orderBy.prepTimeMinutes = sortOrder;
    } else if (sortBy === 'cookTime') {
      orderBy.cookTimeMinutes = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Get recipes
    let recipes = await prisma.recipe.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    });

    // Filter by maxTotalTime if specified
    if (maxTotalTime) {
      recipes = recipes.filter(
        (recipe) => recipe.prepTimeMinutes + recipe.cookTimeMinutes <= maxTotalTime
      );
    }

    // Sort by totalTime if requested
    if (sortBy === 'totalTime') {
      recipes.sort((a, b) => {
        const totalA = a.prepTimeMinutes + a.cookTimeMinutes;
        const totalB = b.prepTimeMinutes + b.cookTimeMinutes;
        return sortOrder === 'asc' ? totalA - totalB : totalB - totalA;
      });
    }

    return {
      items: recipes.map((recipe) => this.formatRecipe(recipe)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get a single recipe by ID
   */
  async getRecipeById(userId: string, recipeId: string): Promise<RecipeResponse> {
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        OR: [{ userId }, { isPublic: true }],
        deletedAt: null,
      },
    });

    if (!recipe) {
      throw new AppError('Recipe not found', 404);
    }

    return this.formatRecipe(recipe);
  }

  /**
   * Update a recipe
   */
  async updateRecipe(
    userId: string,
    recipeId: string,
    data: UpdateRecipeRequest
  ): Promise<RecipeResponse> {
    // Check if recipe exists and belongs to user
    const existingRecipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        userId, // Only owner can update
        deletedAt: null,
      },
    });

    if (!existingRecipe) {
      throw new AppError('Recipe not found', 404);
    }

    // Validate time values if provided
    if (
      (data.prepTimeMinutes !== undefined && data.prepTimeMinutes < 0) ||
      (data.cookTimeMinutes !== undefined && data.cookTimeMinutes < 0)
    ) {
      throw new AppError('Time values must be non-negative', 400);
    }

    // Validate servings if provided
    if (data.servings !== undefined && data.servings <= 0) {
      throw new AppError('Servings must be greater than 0', 400);
    }

    // Validate ingredients if provided
    if (data.ingredients !== undefined && data.ingredients.length === 0) {
      throw new AppError('Recipe must have at least one ingredient', 400);
    }

    // Validate instructions if provided
    if (data.instructions !== undefined && data.instructions.length === 0) {
      throw new AppError('Recipe must have at least one instruction', 400);
    }

    // Prepare update data
    const updateData: any = {};

    if (data.name !== undefined) {
      updateData.title = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.category !== undefined) {
      updateData.category = data.category;
    }
    if (data.difficulty !== undefined) {
      updateData.difficulty = data.difficulty;
    }
    if (data.prepTimeMinutes !== undefined) {
      updateData.prepTimeMinutes = data.prepTimeMinutes;
    }
    if (data.cookTimeMinutes !== undefined) {
      updateData.cookTimeMinutes = data.cookTimeMinutes;
    }
    if (data.servings !== undefined) {
      updateData.servings = data.servings;
    }
    if (data.ingredients !== undefined) {
      updateData.ingredientsList = data.ingredients as any;
    }
    if (data.instructions !== undefined) {
      updateData.instructions = data.instructions;
    }
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl;
    }
    if (data.tags !== undefined) {
      updateData.tags = data.tags;
    }
    if (data.dietaryRestrictions !== undefined) {
      updateData.dietaryRestrictions = data.dietaryRestrictions;
    }
    if (data.isPublic !== undefined) {
      updateData.isPublic = data.isPublic;
    }

    // Update recipe
    const recipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: updateData,
    });

    logger.info('Recipe updated', {
      service: 'smart-grocery-api',
      userId,
      recipeId,
    });

    return this.formatRecipe(recipe);
  }

  /**
   * Delete a recipe (soft delete)
   */
  async deleteRecipe(userId: string, recipeId: string): Promise<void> {
    // Check if recipe exists and belongs to user
    const existingRecipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        userId, // Only owner can delete
        deletedAt: null,
      },
    });

    if (!existingRecipe) {
      throw new AppError('Recipe not found', 404);
    }

    // Soft delete
    await prisma.recipe.update({
      where: { id: recipeId },
      data: { deletedAt: new Date() },
    });

    logger.info('Recipe deleted', {
      service: 'smart-grocery-api',
      userId,
      recipeId,
    });
  }

  /**
   * Get recipe statistics
   */
  async getStats(userId: string): Promise<RecipeStats> {
    const recipes = await prisma.recipe.findMany({
      where: {
        userId,
        deletedAt: null,
      },
    });

    const stats: RecipeStats = {
      totalRecipes: recipes.length,
      byCategory: {},
      byDifficulty: {},
      averagePrepTime: 0,
      averageCookTime: 0,
      averageTotalTime: 0,
    };

    if (recipes.length === 0) {
      return stats;
    }

    // Calculate averages
    const totalPrepTime = recipes.reduce((sum, r) => sum + r.prepTimeMinutes, 0);
    const totalCookTime = recipes.reduce((sum, r) => sum + r.cookTimeMinutes, 0);

    stats.averagePrepTime = Math.round(totalPrepTime / recipes.length);
    stats.averageCookTime = Math.round(totalCookTime / recipes.length);
    stats.averageTotalTime = Math.round(
      (totalPrepTime + totalCookTime) / recipes.length
    );

    // Count by category
    recipes.forEach((recipe) => {
      stats.byCategory[recipe.category] =
        (stats.byCategory[recipe.category] || 0) + 1;
    });

    // Count by difficulty
    recipes.forEach((recipe) => {
      stats.byDifficulty[recipe.difficulty] =
        (stats.byDifficulty[recipe.difficulty] || 0) + 1;
    });

    return stats;
  }

  /**
   * Format recipe for response
   */
  private formatRecipe(recipe: any): RecipeResponse {
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
      ingredients: recipe.ingredientsList as RecipeIngredient[],
      instructions: recipe.instructions,
      imageUrl: recipe.imageUrl,
      tags: recipe.tags,
      dietaryRestrictions: recipe.dietaryRestrictions,
      isPublic: recipe.isPublic,
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
    };
  }
}
