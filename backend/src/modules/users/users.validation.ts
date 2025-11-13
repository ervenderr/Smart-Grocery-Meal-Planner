/**
 * User Request Validation Middleware
 *
 * Validates request bodies for user endpoints.
 */

import { body } from 'express-validator';

/**
 * Validation rules for updating profile
 */
export const updateProfileValidation = [
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
];

/**
 * Validation rules for updating preferences
 */
export const updatePreferencesValidation = [
  body('currency')
    .optional()
    .isString()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code (e.g., USD, EUR)'),

  body('budgetPerWeekCents')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Budget must be a positive integer'),

  body('alertEnabled')
    .optional()
    .isBoolean()
    .withMessage('Alert enabled must be true or false'),

  body('alertThresholdPercentage')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Alert threshold must be between 1 and 100'),

  body('alertChannels')
    .optional()
    .isArray()
    .withMessage('Alert channels must be an array'),

  body('mealsPerDay')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Meals per day must be between 1 and 5'),

  body('dietaryRestrictions')
    .optional()
    .isArray()
    .withMessage('Dietary restrictions must be an array'),

  body('preferredUnit')
    .optional()
    .isString()
    .isIn(['kg', 'lb', 'g', 'oz'])
    .withMessage('Preferred unit must be one of: kg, lb, g, oz'),
];

/**
 * Validation rules for changing password
 */
export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('New password must contain at least one number'),
];

/**
 * Validation rules for account deactivation
 */
export const deactivateAccountValidation = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to deactivate account'),
];
