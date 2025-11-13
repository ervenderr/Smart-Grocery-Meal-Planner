/**
 * Recipe Routes
 *
 * API routes for recipe management.
 */

import { Router } from 'express';
import { RecipeController } from './recipe.controller';
import { authenticate } from '../../middleware/auth.middleware';
import {
  validateCreateRecipe,
  validateUpdateRecipe,
  validateGetRecipes,
  validateRecipeId,
  validate,
} from './recipe.validation';

const router = Router();
const recipeController = new RecipeController();

// All routes require authentication
router.use(authenticate);

// GET /stats must come before /:id to avoid treating 'stats' as an ID
router.get('/stats', recipeController.getStats);

// Recipe CRUD operations
router.post('/', validateCreateRecipe, validate, recipeController.createRecipe);
router.get('/', validateGetRecipes, validate, recipeController.getRecipes);
router.get('/:id', validateRecipeId, validate, recipeController.getRecipeById);
router.patch(
  '/:id',
  validateRecipeId,
  validateUpdateRecipe,
  validate,
  recipeController.updateRecipe
);
router.delete('/:id', validateRecipeId, validate, recipeController.deleteRecipe);

export default router;
