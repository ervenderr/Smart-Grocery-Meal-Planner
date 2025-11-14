/**
 * AI Endpoint Validation
 *
 * Validates AI requests to prevent abuse and ensure data integrity.
 */

import { body, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../../middleware/errorHandler';

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
 * Validation for AI recipe suggestion request
 */
export const validateAIRecipeSuggestion: ValidationChain[] = [
  body('usePantry')
    .optional()
    .isBoolean()
    .withMessage('usePantry must be a boolean'),

  body('dietaryRestrictions')
    .optional()
    .isArray({ max: 10 })
    .withMessage('dietaryRestrictions must be an array with maximum 10 items'),

  body('dietaryRestrictions.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each dietary restriction must be at most 50 characters'),

  body('maxPrepTime')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('maxPrepTime must be between 1 and 480 minutes (8 hours)'),
];

/**
 * Validation for AI substitution request
 */
export const validateAISubstitution: ValidationChain[] = [
  body('ingredients')
    .isArray({ min: 1, max: 50 })
    .withMessage('ingredients must be an array with 1-50 items'),

  body('ingredients.*.ingredientName')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('ingredientName must be 1-200 characters'),

  body('ingredients.*.quantity')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('quantity must be between 0.01 and 10000'),

  body('ingredients.*.unit')
    .isString()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('unit must be 1-20 characters'),

  body('budgetCents')
    .optional()
    .isInt({ min: 0, max: 100000000 })
    .withMessage('budgetCents must be between 0 and 100,000,000'),
];

/**
 * Validation for AI meal plan generation
 */
export const validateAIMealPlan: ValidationChain[] = [
  body('daysCount')
    .optional()
    .isInt({ min: 1, max: 14 })
    .withMessage('daysCount must be between 1 and 14 days'),

  body('budgetCents')
    .isInt({ min: 100, max: 100000000 })
    .withMessage('budgetCents must be between 100 and 100,000,000'),

  body('dietaryRestrictions')
    .optional()
    .isArray({ max: 10 })
    .withMessage('dietaryRestrictions must be an array with maximum 10 items'),

  body('dietaryRestrictions.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each dietary restriction must be at most 50 characters'),

  body('usePantry')
    .optional()
    .isBoolean()
    .withMessage('usePantry must be a boolean'),
];
