/**
 * Meal Plan Validation
 *
 * Request validation rules for meal plan endpoints.
 */

import { body, param, query, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../../middleware/errorHandler';
import { MealType } from '../../types/mealplan.types';

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
 * Validation for creating a meal plan
 */
export const validateCreateMealPlan: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Meal plan name is required')
    .isLength({ max: 200 })
    .withMessage('Meal plan name must be at most 200 characters'),

  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be at most 1000 characters'),

  body('meals')
    .notEmpty()
    .withMessage('Meals are required')
    .isArray({ min: 1 })
    .withMessage('At least one meal is required'),

  body('meals.*.recipeId')
    .notEmpty()
    .withMessage('Recipe ID is required')
    .isUUID()
    .withMessage('Recipe ID must be a valid UUID'),

  body('meals.*.dayOfWeek')
    .notEmpty()
    .withMessage('Day of week is required')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 (Monday) and 6 (Sunday)'),

  body('meals.*.mealType')
    .notEmpty()
    .withMessage('Meal type is required')
    .isIn(Object.values(MealType))
    .withMessage(
      `Meal type must be one of: ${Object.values(MealType).join(', ')}`
    ),

  body('meals.*.servings')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Servings must be at least 1'),
];

/**
 * Validation for updating a meal plan
 */
export const validateUpdateMealPlan: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Meal plan name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Meal plan name must be at most 200 characters'),

  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be at most 1000 characters'),

  body('isFavorite')
    .optional()
    .isBoolean()
    .withMessage('isFavorite must be a boolean'),

  body('meals')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one meal is required'),

  body('meals.*.recipeId')
    .optional()
    .isUUID()
    .withMessage('Recipe ID must be a valid UUID'),

  body('meals.*.dayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 (Monday) and 6 (Sunday)'),

  body('meals.*.mealType')
    .optional()
    .isIn(Object.values(MealType))
    .withMessage(
      `Meal type must be one of: ${Object.values(MealType).join(', ')}`
    ),

  body('meals.*.servings')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Servings must be at least 1'),
];

/**
 * Validation for getting meal plans
 */
export const validateGetMealPlans: ValidationChain[] = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  query('isFavorite')
    .optional()
    .isBoolean()
    .withMessage('isFavorite must be a boolean'),

  query('sortBy')
    .optional()
    .isIn(['name', 'startDate', 'createdAt', 'totalCost'])
    .withMessage('sortBy must be one of: name, startDate, createdAt, totalCost'),

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
 * Validation for meal plan ID parameter
 */
export const validateMealPlanId: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid meal plan ID'),
];
