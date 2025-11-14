/**
 * AI Routes
 *
 * Endpoints for AI-powered features
 */

import { Router } from 'express';
import { AIController } from './ai.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/errorHandler';
import { aiLimiter } from '../../middleware/rateLimiter';
import {
  validateAIRecipeSuggestion,
  validateAISubstitution,
  validateAIMealPlan,
  validate,
} from './ai.validation';

const router = Router();
const aiController = new AIController();

// All AI routes require authentication
router.use(authenticate);

// Apply AI-specific rate limiting (10 requests per hour per user)
router.use(aiLimiter);

/**
 * GET /api/v1/ai/status
 * Check if AI service is available
 */
router.get('/status', asyncHandler(aiController.getStatus.bind(aiController)));

/**
 * POST /api/v1/ai/suggest-recipes
 * Get AI recipe suggestions based on pantry items
 *
 * Body: {
 *   usePantry?: boolean (default: true)
 *   dietaryRestrictions?: string[] (max 10 items)
 *   maxPrepTime?: number (1-480 minutes)
 * }
 */
router.post(
  '/suggest-recipes',
  validateAIRecipeSuggestion,
  validate,
  asyncHandler(aiController.suggestRecipes.bind(aiController))
);

/**
 * POST /api/v1/ai/suggest-substitutions
 * Get ingredient substitution suggestions
 *
 * Body: {
 *   ingredients: Array<{ ingredientName: string, quantity: number, unit: string }> (1-50 items)
 *   budgetCents?: number
 * }
 */
router.post(
  '/suggest-substitutions',
  validateAISubstitution,
  validate,
  asyncHandler(aiController.suggestSubstitutions.bind(aiController))
);

/**
 * POST /api/v1/ai/generate-meal-plan
 * Generate a meal plan using AI
 *
 * Body: {
 *   daysCount?: number (1-14 days)
 *   budgetCents: number (required, 100-100,000,000)
 *   dietaryRestrictions?: string[] (max 10 items)
 *   usePantry?: boolean (default: true)
 * }
 */
router.post(
  '/generate-meal-plan',
  validateAIMealPlan,
  validate,
  asyncHandler(aiController.generateMealPlan.bind(aiController))
);

export default router;
