/**
 * AI Controller
 *
 * Handles HTTP requests for AI-powered features. Dietary restrictions
 * (saved preferences UNION request) are enforced here in code, after the
 * provider/cache step, and are never forwarded to the provider.
 */

import { Request, Response } from 'express';
import { PantryService } from '../pantry/pantry.service';
import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import { getAiDeps } from './ai.deps';
import { normalizeRestrictions } from './dietary-filter';
import { filterMealPlan, filterRecipeSuggestions, filterSubstitutions } from './features/apply-dietary';
import { generateMealPlan } from './features/meal-plan';
import { suggestRecipes } from './features/recipes';
import { suggestSubstitutions } from './features/substitutions';

const pantryService = new PantryService();

const MAX_REQUEST_RESTRICTIONS = 10;
const MAX_RESTRICTION_LENGTH = 50;

interface PantryRow {
  ingredientName: string;
  quantity: number;
  unit: string;
  category: string;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .slice(0, MAX_REQUEST_RESTRICTIONS)
    .map((v) => v.slice(0, MAX_RESTRICTION_LENGTH));
}

async function loadRestrictions(userId: string, requestList: unknown): Promise<readonly string[]> {
  const prefs = await prisma.userPreference.findUnique({
    where: { userId },
    select: { dietaryRestrictions: true },
  });
  return normalizeRestrictions(prefs?.dietaryRestrictions, toStringList(requestList));
}

async function loadPantry(userId: string): Promise<PantryRow[]> {
  const response = await pantryService.getItems(userId, {});
  return response.items.map((item: any) => ({
    ingredientName: item.ingredientName,
    quantity: Number(item.quantity),
    unit: item.unit,
    category: item.category,
  }));
}

export class AIController {
  /**
   * POST /api/v1/ai/suggest-recipes
   */
  async suggestRecipes(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const { maxPrepTime, usePantry = true, dietaryRestrictions, refresh = false } = req.body;

    const pantryItems = usePantry ? await loadPantry(userId) : [];
    if (usePantry && pantryItems.length === 0) {
      res.status(400).json({
        error: 'No pantry items found. Please add items to your pantry first.',
      });
      return;
    }

    const restrictions = await loadRestrictions(userId, dietaryRestrictions);
    const { suggestions, cached } = await suggestRecipes({ userId, pantryItems, maxPrepTime, refresh });
    const { result, filteredOut } = filterRecipeSuggestions(suggestions, restrictions);

    logger.info('AI recipe suggestions generated', {
      service: 'kitcha-api',
      userId,
      suggestionsCount: result.length,
      filteredOut,
      cached,
    });

    res.json({ suggestions: result, pantryItemsUsed: pantryItems.length, filteredOut, cached });
  }

  /**
   * POST /api/v1/ai/suggest-substitutions
   */
  async suggestSubstitutions(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const { ingredients, budgetCents, dietaryRestrictions, refresh = false } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      throw new AppError('Ingredients array is required', 400);
    }

    const restrictions = await loadRestrictions(userId, dietaryRestrictions);
    const { suggestions, cached } = await suggestSubstitutions({ userId, ingredients, budgetCents, refresh });
    const { result, filteredOut } = filterSubstitutions(suggestions, restrictions);

    logger.info('AI substitution suggestions generated', {
      service: 'kitcha-api',
      userId,
      suggestionsCount: result.length,
      filteredOut,
      cached,
    });

    res.json({ suggestions: result, filteredOut, cached });
  }

  /**
   * POST /api/v1/ai/generate-meal-plan
   */
  async generateMealPlan(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const { daysCount = 7, budgetCents, dietaryRestrictions, usePantry = true, refresh = false } = req.body;

    if (!budgetCents || budgetCents <= 0) {
      throw new AppError('Valid budget is required', 400);
    }

    const pantryItems = usePantry ? await loadPantry(userId) : [];
    const restrictions = await loadRestrictions(userId, dietaryRestrictions);
    const { mealPlan, cached } = await generateMealPlan({ userId, daysCount, budgetCents, pantryItems, refresh });
    const { result, filteredOut } = filterMealPlan(mealPlan, restrictions);

    logger.info('AI meal plan generated', {
      service: 'kitcha-api',
      userId,
      daysCount,
      budget: budgetCents,
      filteredOut,
      cached,
    });

    res.json({ mealPlan: result, pantryItemsUsed: pantryItems.length, filteredOut, cached });
  }

  /**
   * GET /api/v1/ai/status
   */
  async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const { provider } = getAiDeps();
      const isAvailable = provider.isConfigured();

      res.json({
        available: isAvailable,
        provider: provider.label,
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
