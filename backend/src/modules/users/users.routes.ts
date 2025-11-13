/**
 * Users Routes
 *
 * Defines all user-related API endpoints.
 *
 * All routes require authentication (JWT token).
 */

import { Router } from 'express';
import { usersController } from './users.controller';
import {
  updateProfileValidation,
  updatePreferencesValidation,
  changePasswordValidation,
  deactivateAccountValidation,
} from './users.validation';
import { validate } from '@/modules/auth/auth.validation';
import { authenticate } from '@/middleware/auth.middleware';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/users/profile
 * Get current user's profile
 *
 * PROTECTED (requires JWT token)
 *
 * Response (200):
 * {
 *   "id": "uuid",
 *   "email": "user@example.com",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "isActive": true,
 *   "createdAt": "...",
 *   "lastLogin": "..."
 * }
 */
router.get(
  '/profile',
  asyncHandler(usersController.getProfile.bind(usersController))
);

/**
 * PATCH /api/v1/users/profile
 * Update current user's profile
 *
 * PROTECTED (requires JWT token)
 *
 * Body:
 * {
 *   "firstName": "John",      // optional
 *   "lastName": "Doe",        // optional
 *   "email": "new@email.com"  // optional
 * }
 *
 * Response (200):
 * Updated profile object
 */
router.patch(
  '/profile',
  updateProfileValidation,
  validate,
  asyncHandler(usersController.updateProfile.bind(usersController))
);

/**
 * GET /api/v1/users/preferences
 * Get current user's preferences
 *
 * PROTECTED (requires JWT token)
 *
 * Response (200):
 * {
 *   "id": "uuid",
 *   "userId": "uuid",
 *   "currency": "USD",
 *   "budgetPerWeekCents": 10000,
 *   ...
 * }
 */
router.get(
  '/preferences',
  asyncHandler(usersController.getPreferences.bind(usersController))
);

/**
 * PATCH /api/v1/users/preferences
 * Update current user's preferences
 *
 * PROTECTED (requires JWT token)
 *
 * Body (all optional):
 * {
 *   "currency": "USD",
 *   "budgetPerWeekCents": 15000,
 *   "alertEnabled": true,
 *   "mealsPerDay": 3,
 *   "dietaryRestrictions": ["vegan"],
 *   ...
 * }
 *
 * Response (200):
 * Updated preferences object
 */
router.patch(
  '/preferences',
  updatePreferencesValidation,
  validate,
  asyncHandler(usersController.updatePreferences.bind(usersController))
);

/**
 * PATCH /api/v1/users/password
 * Change user password
 *
 * PROTECTED (requires JWT token)
 *
 * Body:
 * {
 *   "currentPassword": "OldPass123",
 *   "newPassword": "NewPass456"
 * }
 *
 * Response (200):
 * {
 *   "message": "Password changed successfully"
 * }
 */
router.patch(
  '/password',
  changePasswordValidation,
  validate,
  asyncHandler(usersController.changePassword.bind(usersController))
);

/**
 * DELETE /api/v1/users/account
 * Deactivate user account (soft delete)
 *
 * PROTECTED (requires JWT token)
 *
 * Body:
 * {
 *   "password": "UserPass123"
 * }
 *
 * Response (200):
 * {
 *   "message": "Account deactivated successfully"
 * }
 */
router.delete(
  '/account',
  deactivateAccountValidation,
  validate,
  asyncHandler(usersController.deactivateAccount.bind(usersController))
);

export default router;
