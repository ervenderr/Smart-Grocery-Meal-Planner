/**
 * Recipe Controller
 *
 * HTTP request handlers for recipe endpoints.
 */

import { Request, Response } from 'express';
import { RecipeService } from './recipe.service';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  CreateRecipeRequest,
  UpdateRecipeRequest,
  GetRecipesQuery,
} from '../../types/recipe.types';

export class RecipeController {
  private recipeService: RecipeService;

  constructor() {
    this.recipeService = new RecipeService();
  }

  /**
   * Create a new recipe
   * POST /api/v1/recipes
   */
  createRecipe = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const data: CreateRecipeRequest = req.body;

    const recipe = await this.recipeService.createRecipe(userId, data);

    res.status(201).json(recipe);
  });

  /**
   * Get all recipes with filtering and pagination
   * GET /api/v1/recipes
   */
  getRecipes = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const query: GetRecipesQuery = {
      category: req.query.category as string,
      difficulty: req.query.difficulty as string,
      dietaryRestriction: req.query.dietaryRestriction as string,
      maxPrepTime: req.query.maxPrepTime
        ? parseInt(req.query.maxPrepTime as string)
        : undefined,
      maxCookTime: req.query.maxCookTime
        ? parseInt(req.query.maxCookTime as string)
        : undefined,
      maxTotalTime: req.query.maxTotalTime
        ? parseInt(req.query.maxTotalTime as string)
        : undefined,
      search: req.query.search as string,
      tags: req.query.tags as string,
      includePublic: req.query.includePublic === 'true',
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await this.recipeService.getRecipes(userId, query);

    res.status(200).json(result);
  });

  /**
   * Get a single recipe by ID
   * GET /api/v1/recipes/:id
   */
  getRecipeById = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const recipeId = req.params.id;

    const recipe = await this.recipeService.getRecipeById(userId, recipeId);

    res.status(200).json(recipe);
  });

  /**
   * Update a recipe
   * PATCH /api/v1/recipes/:id
   */
  updateRecipe = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const recipeId = req.params.id;
    const data: UpdateRecipeRequest = req.body;

    const recipe = await this.recipeService.updateRecipe(userId, recipeId, data);

    res.status(200).json(recipe);
  });

  /**
   * Delete a recipe
   * DELETE /api/v1/recipes/:id
   */
  deleteRecipe = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const recipeId = req.params.id;

    await this.recipeService.deleteRecipe(userId, recipeId);

    res.status(200).json({ message: 'Recipe deleted successfully' });
  });

  /**
   * Get recipe statistics
   * GET /api/v1/recipes/stats
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const stats = await this.recipeService.getStats(userId);

    res.status(200).json(stats);
  });
}
