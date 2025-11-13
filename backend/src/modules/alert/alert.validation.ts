import { body, param, query, ValidationChain } from 'express-validator';
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

export const validateCreateAlert: ValidationChain[] = [
  body('alertType')
    .trim()
    .notEmpty()
    .withMessage('Alert type is required')
    .isIn(['budget_exceeded', 'item_expiring', 'price_spike', 'trend_alert'])
    .withMessage('Invalid alert type'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 5, max: 500 })
    .withMessage('Message must be between 5 and 500 characters'),
  body('threshold')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Threshold must be a positive number'),
  body('actualValue')
    .optional()
    .isFloat()
    .withMessage('Actual value must be a number'),
];

export const validateGetAlerts: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('alertType')
    .optional()
    .trim()
    .isIn(['budget_exceeded', 'item_expiring', 'price_spike', 'trend_alert'])
    .withMessage('Invalid alert type'),
  query('isRead')
    .optional()
    .isBoolean()
    .withMessage('isRead must be a boolean')
    .toBoolean(),
  query('includeRead')
    .optional()
    .isBoolean()
    .withMessage('includeRead must be a boolean')
    .toBoolean(),
  query('includeDismissed')
    .optional()
    .isBoolean()
    .withMessage('includeDismissed must be a boolean')
    .toBoolean(),
];

export const validateAlertId: ValidationChain[] = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Alert ID is required')
    .isUUID()
    .withMessage('Invalid alert ID format'),
];
