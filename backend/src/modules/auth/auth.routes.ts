/**
 * Authentication Routes
 *
 * Defines all auth-related API endpoints.
 *
 * ROUTE → VALIDATION → CONTROLLER → SERVICE → DATABASE
 *
 * Each route:
 * 1. Defines HTTP method & path
 * 2. Adds validation middleware (if needed)
 * 3. Adds auth middleware (if protected)
 * 4. Calls controller method
 * 5. Controller calls service
 * 6. Service interacts with database
 */

import { Router } from 'express';
import { authController } from './auth.controller';
import { signupValidation, loginValidation, validate } from './auth.validation';
import { authenticate } from '@/middleware/auth.middleware';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();

/**
 * POST /api/v1/auth/signup
 * Register a new user
 *
 * PUBLIC (no auth required)
 *
 * Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123",
 *   "firstName": "John",     // optional
 *   "lastName": "Doe"        // optional
 * }
 *
 * Response (201):
 * {
 *   "user": { ... },
 *   "token": "eyJhbGci...",
 *   "expiresIn": "7d"
 * }
 */
router.post(
  '/signup',
  signupValidation,
  validate,
  asyncHandler(authController.signup.bind(authController))
);

/**
 * POST /api/v1/auth/login
 * Login existing user
 *
 * PUBLIC (no auth required)
 *
 * Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123"
 * }
 *
 * Response (200):
 * {
 *   "user": { ... },
 *   "token": "eyJhbGci...",
 *   "expiresIn": "7d"
 * }
 */
router.post(
  '/login',
  loginValidation,
  validate,
  asyncHandler(authController.login.bind(authController))
);

/**
 * POST /api/v1/auth/logout
 * Logout user (client-side action)
 *
 * PUBLIC (but usually called with token)
 *
 * Response (200):
 * {
 *   "message": "Logout successful"
 * }
 */
router.post(
  '/logout',
  asyncHandler(authController.logout.bind(authController))
);

/**
 * GET /api/v1/auth/me
 * Get current user profile
 *
 * PROTECTED (requires JWT token)
 *
 * Headers:
 * Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "id": "uuid",
 *   "email": "user@example.com",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "createdAt": "2024-01-01T00:00:00.000Z"
 * }
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(authController.getProfile.bind(authController))
);

export default router;
