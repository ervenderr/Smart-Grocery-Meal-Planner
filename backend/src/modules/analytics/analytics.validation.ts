/**
 * Analytics Validation
 *
 * Request validation for analytics endpoints using express-validator.
 */

import { query, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../../middleware/errorHandler';

/**
 * Validation middleware wrapper
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
 * Validate spending trends query
 */
export const validateSpendingTrends: ValidationChain[] = [
  query('period')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Period must be one of: daily, weekly, monthly'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

/**
 * Validate category breakdown query
 */
export const validateCategoryBreakdown: ValidationChain[] = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('minAmount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum amount must be a positive integer')
    .toInt(),
];

/**
 * Validate top items query
 */
export const validateTopItems: ValidationChain[] = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('sortBy')
    .optional()
    .isIn(['quantity', 'spending', 'frequency'])
    .withMessage('Sort by must be one of: quantity, spending, frequency'),
];

/**
 * Validate budget comparison query
 */
export const validateBudgetComparison: ValidationChain[] = [
  query('period')
    .optional()
    .isIn(['weekly', 'monthly', 'yearly'])
    .withMessage('Period must be one of: weekly, monthly, yearly'),
  query('count')
    .optional()
    .isInt({ min: 1, max: 52 })
    .withMessage('Count must be between 1 and 52')
    .toInt(),
];

/**
 * Validate price trends query
 */
export const validatePriceTrends: ValidationChain[] = [
  query('ingredientName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Ingredient name must be between 1 and 100 characters'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('period')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Period must be one of: daily, weekly, monthly'),
];
