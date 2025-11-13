/**
 * Market Price Validation
 *
 * Request validation rules for market price endpoints.
 */

import { body, param, query, ValidationChain } from 'express-validator';
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
 * Validation for fetching price
 */
export const validateFetchPrice: ValidationChain[] = [
  body('symbol')
    .trim()
    .notEmpty()
    .withMessage('Symbol is required')
    .isLength({ min: 2, max: 10 })
    .withMessage('Symbol must be between 2 and 10 characters')
    .toUpperCase(),
];

/**
 * Validation for currency conversion
 */
export const validateConversion: ValidationChain[] = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),

  body('fromCurrency')
    .trim()
    .notEmpty()
    .withMessage('From currency is required')
    .isLength({ min: 2, max: 10 })
    .withMessage('From currency must be between 2 and 10 characters')
    .toUpperCase(),

  body('toCurrency')
    .trim()
    .notEmpty()
    .withMessage('To currency is required')
    .isLength({ min: 2, max: 10 })
    .withMessage('To currency must be between 2 and 10 characters')
    .toUpperCase(),
];

/**
 * Validation for getting market prices
 */
export const validateGetMarketPrices: ValidationChain[] = [
  query('symbol')
    .optional()
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Symbol must be between 2 and 10 characters')
    .toUpperCase(),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

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
 * Validation for symbol parameter
 */
export const validateSymbol: ValidationChain[] = [
  param('symbol')
    .trim()
    .notEmpty()
    .withMessage('Symbol is required')
    .isLength({ min: 2, max: 10 })
    .withMessage('Symbol must be between 2 and 10 characters')
    .toUpperCase(),
];

/**
 * Validation for price history query
 */
export const validatePriceHistory: ValidationChain[] = [
  param('symbol')
    .trim()
    .notEmpty()
    .withMessage('Symbol is required')
    .isLength({ min: 2, max: 10 })
    .withMessage('Symbol must be between 2 and 10 characters')
    .toUpperCase(),

  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
];
