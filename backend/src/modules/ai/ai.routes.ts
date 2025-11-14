/**
 * AI Routes
 *
 * Endpoints for AI-powered features
 */

import { Router } from 'express';
import { AIController } from './ai.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();
const aiController = new AIController();

// All AI routes require authentication
router.use(authenticate);

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
 *   dietaryRestrictions?: string[]
 *   maxPrepTime?: number
 * }
 */
router.post('/suggest-recipes', asyncHandler(aiController.suggestRecipes.bind(aiController)));

/**
 * POST /api/v1/ai/suggest-substitutions
 * Get ingredient substitution suggestions
 *
 * Body: {
 *   ingredients: Array<{ ingredientName: string, quantity: number, unit: string }>
 *   budgetCents?: number
 * }
 */
router.post('/suggest-substitutions', asyncHandler(aiController.suggestSubstitutions.bind(aiController)));

/**
 * POST /api/v1/ai/generate-meal-plan
 * Generate a meal plan using AI
 *
 * Body: {
 *   daysCount?: number (default: 7)
 *   budgetCents: number (required)
 *   dietaryRestrictions?: string[]
 *   usePantry?: boolean (default: true)
 * }
 */
router.post('/generate-meal-plan', asyncHandler(aiController.generateMealPlan.bind(aiController)));

export default router;
