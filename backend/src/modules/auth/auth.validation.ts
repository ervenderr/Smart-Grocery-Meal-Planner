/**
 * Auth Request Validation Middleware
 *
 * Validates request bodies using express-validator.
 *
 * WHY VALIDATE?
 * - Prevent invalid data from reaching service layer
 * - Clear error messages for frontend
 * - Security (prevent injection attacks)
 * - Type safety at runtime (TypeScript only checks compile-time)
 */

import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/middleware/errorHandler';

/**
 * Validation rules for signup
 */
export const signupValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),

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
 * Validation rules for login
 */
export const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * Middleware to check validation results
 *
 * USE AFTER VALIDATION RULES:
 * router.post('/signup', signupValidation, validate, authController.signup);
 *                                          ^^^^^^^^
 *                                          This checks results
 */
export function validate(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Throw AppError with 400 status (errors will be in response)
    throw new AppError('Validation failed', 400);
  }

  next();
}
