/**
 * Pantry Validation
 *
 * Request validation for pantry endpoints using express-validator.
 */

import { body, query, param, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../../middleware/errorHandler';
import { PantryCategory, PantryUnit, PantryLocation } from '../../types/pantry.types';

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
 * Create pantry item validation
 */
export const validateCreateItem: ValidationChain[] = [
  body('ingredientName')
    .trim()
    .notEmpty()
    .withMessage('Ingredient name is required')
    .isLength({ max: 100 })
    .withMessage('Ingredient name must be at most 100 characters'),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be greater than 0'),

  body('unit')
    .trim()
    .notEmpty()
    .withMessage('Unit is required')
    .isIn(Object.values(PantryUnit))
    .withMessage(
      `Unit must be one of: ${Object.values(PantryUnit).join(', ')}`
    ),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isIn(Object.values(PantryCategory))
    .withMessage(
      `Category must be one of: ${Object.values(PantryCategory).join(', ')}`
    ),

  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be a valid ISO 8601 date'),

  body('purchaseDate')
    .optional()
    .isISO8601()
    .withMessage('Purchase date must be a valid ISO 8601 date'),

  body('purchasePriceCents')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Purchase price must be a non-negative integer (in cents)'),

  body('location')
    .optional()
    .trim()
    .isIn(Object.values(PantryLocation))
    .withMessage(
      `Location must be one of: ${Object.values(PantryLocation).join(', ')}`
    ),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be at most 500 characters'),
];

/**
 * Update pantry item validation
 */
export const validateUpdateItem: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid item ID'),

  body('ingredientName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Ingredient name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Ingredient name must be at most 100 characters'),

  body('quantity')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be greater than 0'),

  body('unit')
    .optional()
    .trim()
    .isIn(Object.values(PantryUnit))
    .withMessage(
      `Unit must be one of: ${Object.values(PantryUnit).join(', ')}`
    ),

  body('category')
    .optional()
    .trim()
    .isIn(Object.values(PantryCategory))
    .withMessage(
      `Category must be one of: ${Object.values(PantryCategory).join(', ')}`
    ),

  body('expiryDate')
    .optional({ nullable: true })
    .custom((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value))
    .withMessage('Expiry date must be a valid ISO 8601 date or null'),

  body('purchaseDate')
    .optional({ nullable: true })
    .custom((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value))
    .withMessage('Purchase date must be a valid ISO 8601 date or null'),

  body('purchasePriceCents')
    .optional({ nullable: true })
    .custom((value) => value === null || (Number.isInteger(value) && value >= 0))
    .withMessage('Purchase price must be a non-negative integer (in cents) or null'),

  body('location')
    .optional({ nullable: true })
    .custom((value) => value === null || Object.values(PantryLocation).includes(value))
    .withMessage(
      `Location must be one of: ${Object.values(PantryLocation).join(', ')} or null`
    ),

  body('notes')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null) return true;
      if (typeof value !== 'string') return false;
      return value.trim().length <= 500;
    })
    .withMessage('Notes must be at most 500 characters or null'),
];

/**
 * Get pantry items query validation
 */
export const validateGetItems: ValidationChain[] = [
  query('category')
    .optional()
    .isIn(Object.values(PantryCategory))
    .withMessage(
      `Category must be one of: ${Object.values(PantryCategory).join(', ')}`
    ),

  query('location')
    .optional()
    .isIn(Object.values(PantryLocation))
    .withMessage(
      `Location must be one of: ${Object.values(PantryLocation).join(', ')}`
    ),

  query('expiringSoon')
    .optional()
    .isBoolean()
    .withMessage('expiringSoon must be a boolean'),

  query('expired')
    .optional()
    .isBoolean()
    .withMessage('expired must be a boolean'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must be at most 100 characters'),

  query('sortBy')
    .optional()
    .isIn(['name', 'expiryDate', 'quantity', 'createdAt'])
    .withMessage('sortBy must be one of: name, expiryDate, quantity, createdAt'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be either asc or desc'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
];

/**
 * Get/Delete item by ID validation
 */
export const validateItemId: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid item ID'),
];
