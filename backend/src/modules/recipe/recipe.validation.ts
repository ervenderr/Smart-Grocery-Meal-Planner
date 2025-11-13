/**
 * Recipe Validation
 *
 * Request validation rules for recipe endpoints.
 */

import { body, param, query, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../../middleware/errorHandler';
import {
  RecipeCategory,
  RecipeDifficulty,
  DietaryRestriction,
} from '../../types/recipe.types';
import { PantryUnit } from '../../types/pantry.types';

/**
 * Validation middleware
 */
export const validate = (req: Request, _res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map((err: any) => `${err.path}: ${err.msg}`)
      .join(', ');
    throw new AppError(`Validation failed: ${errorMessages}`, 400);
  }
  next();
};

/**
 * Validation for creating a recipe
 */
export const validateCreateRecipe: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Recipe name is required')
    .isLength({ max: 200 })
    .withMessage('Recipe name must be at most 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be at most 1000 characters'),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isIn(Object.values(RecipeCategory))
    .withMessage(
      `Category must be one of: ${Object.values(RecipeCategory).join(', ')}`
    ),

  body('difficulty')
    .trim()
    .notEmpty()
    .withMessage('Difficulty is required')
    .isIn(Object.values(RecipeDifficulty))
    .withMessage(
      `Difficulty must be one of: ${Object.values(RecipeDifficulty).join(', ')}`
    ),

  body('prepTimeMinutes')
    .notEmpty()
    .withMessage('Prep time is required')
    .isInt({ min: 0 })
    .withMessage('Prep time must be a non-negative integer'),

  body('cookTimeMinutes')
    .notEmpty()
    .withMessage('Cook time is required')
    .isInt({ min: 0 })
    .withMessage('Cook time must be a non-negative integer'),

  body('servings')
    .notEmpty()
    .withMessage('Servings is required')
    .isInt({ min: 1 })
    .withMessage('Servings must be at least 1'),

  body('ingredients')
    .notEmpty()
    .withMessage('Ingredients are required')
    .isArray({ min: 1 })
    .withMessage('At least one ingredient is required'),

  body('ingredients.*.ingredientName')
    .trim()
    .notEmpty()
    .withMessage('Ingredient name is required'),

  body('ingredients.*.quantity')
    .notEmpty()
    .withMessage('Ingredient quantity is required')
    .isFloat({ gt: 0 })
    .withMessage('Ingredient quantity must be greater than 0'),

  body('ingredients.*.unit')
    .trim()
    .notEmpty()
    .withMessage('Ingredient unit is required')
    .isIn(Object.values(PantryUnit))
    .withMessage(
      `Ingredient unit must be one of: ${Object.values(PantryUnit).join(', ')}`
    ),

  body('instructions')
    .notEmpty()
    .withMessage('Instructions are required')
    .isArray({ min: 1 })
    .withMessage('At least one instruction is required'),

  body('instructions.*')
    .trim()
    .notEmpty()
    .withMessage('Instruction cannot be empty'),

  body('imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL must be a valid URL'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Tag cannot be empty'),

  body('dietaryRestrictions')
    .optional()
    .isArray()
    .withMessage('Dietary restrictions must be an array'),

  body('dietaryRestrictions.*')
    .optional()
    .isIn(Object.values(DietaryRestriction))
    .withMessage(
      `Dietary restriction must be one of: ${Object.values(DietaryRestriction).join(', ')}`
    ),

  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
];

/**
 * Validation for updating a recipe
 */
export const validateUpdateRecipe: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Recipe name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Recipe name must be at most 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be at most 1000 characters'),

  body('category')
    .optional()
    .trim()
    .isIn(Object.values(RecipeCategory))
    .withMessage(
      `Category must be one of: ${Object.values(RecipeCategory).join(', ')}`
    ),

  body('difficulty')
    .optional()
    .trim()
    .isIn(Object.values(RecipeDifficulty))
    .withMessage(
      `Difficulty must be one of: ${Object.values(RecipeDifficulty).join(', ')}`
    ),

  body('prepTimeMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Prep time must be a non-negative integer'),

  body('cookTimeMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Cook time must be a non-negative integer'),

  body('servings')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Servings must be at least 1'),

  body('ingredients')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one ingredient is required'),

  body('ingredients.*.ingredientName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Ingredient name is required'),

  body('ingredients.*.quantity')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Ingredient quantity must be greater than 0'),

  body('ingredients.*.unit')
    .optional()
    .trim()
    .isIn(Object.values(PantryUnit))
    .withMessage(
      `Ingredient unit must be one of: ${Object.values(PantryUnit).join(', ')}`
    ),

  body('instructions')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one instruction is required'),

  body('instructions.*')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Instruction cannot be empty'),

  body('imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL must be a valid URL'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('dietaryRestrictions')
    .optional()
    .isArray()
    .withMessage('Dietary restrictions must be an array'),

  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
];

/**
 * Validation for getting recipes
 */
export const validateGetRecipes: ValidationChain[] = [
  query('category')
    .optional()
    .isIn(Object.values(RecipeCategory))
    .withMessage(
      `Category must be one of: ${Object.values(RecipeCategory).join(', ')}`
    ),

  query('difficulty')
    .optional()
    .isIn(Object.values(RecipeDifficulty))
    .withMessage(
      `Difficulty must be one of: ${Object.values(RecipeDifficulty).join(', ')}`
    ),

  query('dietaryRestriction')
    .optional()
    .isIn(Object.values(DietaryRestriction))
    .withMessage(
      `Dietary restriction must be one of: ${Object.values(DietaryRestriction).join(', ')}`
    ),

  query('maxPrepTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Max prep time must be a non-negative integer'),

  query('maxCookTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Max cook time must be a non-negative integer'),

  query('maxTotalTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Max total time must be a non-negative integer'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),

  query('includePublic')
    .optional()
    .isBoolean()
    .withMessage('includePublic must be a boolean'),

  query('sortBy')
    .optional()
    .isIn(['name', 'prepTime', 'cookTime', 'totalTime', 'createdAt'])
    .withMessage(
      'sortBy must be one of: name, prepTime, cookTime, totalTime, createdAt'
    ),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be either asc or desc'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be at least 1'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

/**
 * Validation for recipe ID parameter
 */
export const validateRecipeId: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid recipe ID'),
];
