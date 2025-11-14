/**
 * Meal Plan Routes
 *
 * API routes for meal planning endpoints.
 */

import { Router } from 'express';
import { MealPlanController } from './mealplan.controller';
import { authenticate } from '../../middleware/auth.middleware';
import {
  validateCreateMealPlan,
  validateUpdateMealPlan,
  validateGetMealPlans,
  validateMealPlanId,
  validate,
} from './mealplan.validation';

const router = Router();
const mealPlanController = new MealPlanController();

// All meal plan routes require authentication
router.use(authenticate);

// Statistics endpoint (must come before /:id)
router.get('/stats', mealPlanController.getStats);

// Create meal plan from AI suggestion (must come before / to avoid conflict)
router.post('/from-ai', mealPlanController.createMealPlanFromAI);

// CRUD routes
router.post(
  '/',
  validateCreateMealPlan,
  validate,
  mealPlanController.createMealPlan
);

router.get(
  '/',
  validateGetMealPlans,
  validate,
  mealPlanController.getMealPlans
);

router.get(
  '/:id',
  validateMealPlanId,
  validate,
  mealPlanController.getMealPlanById
);

router.patch(
  '/:id',
  validateMealPlanId,
  validateUpdateMealPlan,
  validate,
  mealPlanController.updateMealPlan
);

router.delete(
  '/:id',
  validateMealPlanId,
  validate,
  mealPlanController.deleteMealPlan
);

// Shopping list generation
router.get(
  '/:id/shopping-list',
  validateMealPlanId,
  validate,
  mealPlanController.generateShoppingList
);

export default router;
