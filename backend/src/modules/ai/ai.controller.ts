/**
 * AI Controller
 *
 * Handles HTTP requests for AI-powered features
 */

import { Request, Response } from 'express';
import { AIService } from './ai.service';
import { PantryService } from '../pantry/pantry.service';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';

const aiService = new AIService();
const pantryService = new PantryService();

export class AIController {
  /**
   * POST /api/v1/ai/suggest-recipes
   * Get AI-generated recipe suggestions based on pantry items
   */
  async suggestRecipes(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { dietaryRestrictions, maxPrepTime, usePantry = true } = req.body;

      if (!aiService.isAvailable()) {
        res.status(503).json({
          error: 'AI service is not available. Please configure GEMINI_AI_API_KEY.',
        });
        return;
      }

      // Get user's pantry items
      let pantryItems: any[] = [];
      if (usePantry) {
        const pantryResponse = await pantryService.getItems(userId, {});
        pantryItems = pantryResponse.items.map((item: any) => ({
          ingredientName: item.ingredientName,
          quantity: Number(item.quantity),
          unit: item.unit,
          category: item.category,
        }));

        if (pantryItems.length === 0) {
          res.status(400).json({
            error: 'No pantry items found. Please add items to your pantry first.',
          });
          return;
        }
      }

      // Get AI suggestions
      const suggestions = await aiService.suggestRecipesFromPantry(
        pantryItems,
        dietaryRestrictions || [],
        maxPrepTime
      );

      logger.info('AI recipe suggestions generated', {
        service: 'smart-grocery-api',
        userId,
        suggestionsCount: suggestions.length,
      });

      res.json({
        suggestions,
        pantryItemsUsed: pantryItems.length,
      });
    } catch (error: any) {
      logger.error('Suggest recipes error:', error);
      throw error;
    }
  }

  /**
   * POST /api/v1/ai/suggest-substitutions
   * Get AI-generated ingredient substitution suggestions
   */
  async suggestSubstitutions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { ingredients, budgetCents } = req.body;

      if (!aiService.isAvailable()) {
        res.status(503).json({
          error: 'AI service is not available. Please configure GEMINI_AI_API_KEY.',
        });
        return;
      }

      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        throw new AppError('Ingredients array is required', 400);
      }

      // Get AI substitution suggestions
      const suggestions = await aiService.suggestIngredientSubstitutions(
        ingredients,
        budgetCents
      );

      logger.info('AI substitution suggestions generated', {
        service: 'smart-grocery-api',
        userId,
        suggestionsCount: suggestions.length,
      });

      res.json({ suggestions });
    } catch (error: any) {
      logger.error('Suggest substitutions error:', error);
      throw error;
    }
  }

  /**
   * POST /api/v1/ai/generate-meal-plan
   * Generate a meal plan using AI
   */
  async generateMealPlan(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { daysCount = 7, budgetCents, dietaryRestrictions = [], usePantry = true } = req.body;

      if (!aiService.isAvailable()) {
        res.status(503).json({
          error: 'AI service is not available. Please configure GEMINI_AI_API_KEY.',
        });
        return;
      }

      if (!budgetCents || budgetCents <= 0) {
        throw new AppError('Valid budget is required', 400);
      }

      // Get user's pantry items if requested
      let pantryItems: any[] = [];
      if (usePantry) {
        const pantryResponse = await pantryService.getItems(userId, {});
        pantryItems = pantryResponse.items.map((item: any) => ({
          ingredientName: item.ingredientName,
          quantity: Number(item.quantity),
          unit: item.unit,
        }));
      }

      // Generate AI meal plan
      const mealPlan = await aiService.generateMealPlan(
        daysCount,
        budgetCents,
        dietaryRestrictions,
        pantryItems
      );

      logger.info('AI meal plan generated', {
        service: 'smart-grocery-api',
        userId,
        daysCount,
        budget: budgetCents,
      });

      res.json({
        mealPlan,
        pantryItemsUsed: pantryItems.length,
      });
    } catch (error: any) {
      logger.error('Generate meal plan error:', error);
      throw error;
    }
  }

  /**
   * GET /api/v1/ai/status
   * Check if AI service is available
   */
  async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const isAvailable = aiService.isAvailable();

      res.json({
        available: isAvailable,
        provider: 'Google Gemini AI',
        features: {
          recipeSuggestions: isAvailable,
          ingredientSubstitutions: isAvailable,
          mealPlanGeneration: isAvailable,
        },
      });
    } catch (error: any) {
      logger.error('AI status check error:', error);
      throw error;
    }
  }
}
