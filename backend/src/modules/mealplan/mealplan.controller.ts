/**
 * Meal Plan Controller
 *
 * HTTP request handlers for meal plan endpoints.
 */

import { Request, Response } from 'express';
import { MealPlanService } from './mealplan.service';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  CreateMealPlanRequest,
  UpdateMealPlanRequest,
  GetMealPlansQuery,
} from '../../types/mealplan.types';

export class MealPlanController {
  private mealPlanService: MealPlanService;

  constructor() {
    this.mealPlanService = new MealPlanService();
  }

  /**
   * Create a new meal plan
   * POST /api/v1/mealplans
   */
  createMealPlan = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const data: CreateMealPlanRequest = req.body;

    const mealPlan = await this.mealPlanService.createMealPlan(userId, data);
    res.status(201).json(mealPlan);
  });

  /**
   * Get all meal plans
   * GET /api/v1/mealplans
   */
  getMealPlans = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const query: GetMealPlansQuery = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      isFavorite: req.query.isFavorite === 'true' ? true : undefined,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await this.mealPlanService.getMealPlans(userId, query);
    res.status(200).json(result);
  });

  /**
   * Get a single meal plan
   * GET /api/v1/mealplans/:id
   */
  getMealPlanById = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const mealPlan = await this.mealPlanService.getMealPlanById(userId, id);
    res.status(200).json(mealPlan);
  });

  /**
   * Update a meal plan
   * PATCH /api/v1/mealplans/:id
   */
  updateMealPlan = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const data: UpdateMealPlanRequest = req.body;

    const mealPlan = await this.mealPlanService.updateMealPlan(userId, id, data);
    res.status(200).json(mealPlan);
  });

  /**
   * Delete a meal plan
   * DELETE /api/v1/mealplans/:id
   */
  deleteMealPlan = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await this.mealPlanService.deleteMealPlan(userId, id);
    res.status(200).json({ message: 'Meal plan deleted successfully' });
  });

  /**
   * Get meal plan statistics
   * GET /api/v1/mealplans/stats
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const stats = await this.mealPlanService.getStats(userId);
    res.status(200).json(stats);
  });

  /**
   * Generate shopping list from meal plan
   * GET /api/v1/mealplans/:id/shopping-list
   */
  generateShoppingList = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const shoppingList = await this.mealPlanService.generateShoppingList(userId, id);
    res.status(200).json(shoppingList);
  });
}
