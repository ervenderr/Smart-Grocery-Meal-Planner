/**
 * Notification Validation
 *
 * Request validation for notification endpoints
 */

import { body, ValidationChain } from 'express-validator';

/**
 * Validation for creating a notification
 */
export const validateCreateNotification: ValidationChain[] = [
  body('notificationType')
    .isString()
    .isIn([
      'ingredient_expiring',
      'ingredient_expired',
      'budget_warning',
      'budget_exceeded',
      'meal_prep_reminder',
      'shopping_day_reminder',
      'low_stock',
      'price_drop',
      'meal_plan_due',
    ])
    .withMessage('Invalid notification type'),

  body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),

  body('message')
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),

  body('priority')
    .optional()
    .isString()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, normal, high, urgent'),

  body('actionUrl')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Action URL must be less than 500 characters'),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),

  body('scheduledFor')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date'),
];
