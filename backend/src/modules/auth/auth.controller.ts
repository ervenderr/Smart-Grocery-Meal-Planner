/**
 * Authentication Controller
 *
 * Handles HTTP requests for authentication.
 * Thin layer between routes and service.
 *
 * RESPONSIBILITIES:
 * - Parse request data
 * - Call service methods
 * - Format responses
 * - Handle errors (via global error handler)
 */

import { Request, Response } from 'express';
import { authService } from './auth.service';
import { SignupRequest, LoginRequest } from '@/types/auth.types';
import { AppError } from '@/middleware/errorHandler';
import { refreshBodySchema, logoutBodySchema } from './refresh-token.validation';
import { revokeFamilyByToken } from './refresh-token.service';

export class AuthController {
  /**
   * POST /api/v1/auth/signup
   * Register a new user
   *
   * REQUEST BODY:
   * {
   *   "email": "user@example.com",
   *   "password": "SecurePass123",
   *   "firstName": "John",     // optional
   *   "lastName": "Doe"        // optional
   * }
   *
   * RESPONSE (201):
   * {
   *   "user": { "id", "email", "firstName", "lastName", "createdAt" },
   *   "token": "eyJhbGciOi...",
   *   "expiresIn": "7d"
   * }
   */
  async signup(req: Request, res: Response): Promise<void> {
    const data: SignupRequest = req.body;

    const result = await authService.signup(data);

    res.status(201).json(result);
  }

  /**
   * POST /api/v1/auth/login
   * Login existing user
   *
   * REQUEST BODY:
   * {
   *   "email": "user@example.com",
   *   "password": "SecurePass123"
   * }
   *
   * RESPONSE (200):
   * {
   *   "user": { "id", "email", "firstName", "lastName", "createdAt" },
   *   "token": "eyJhbGciOi...",
   *   "expiresIn": "7d"
   * }
   */
  async login(req: Request, res: Response): Promise<void> {
    const data: LoginRequest = req.body;

    const result = await authService.login(data);

    res.status(200).json(result);
  }

  /**
   * POST /api/v1/auth/refresh
   * Body: { "refreshToken": "<43 chars>" }
   * Response (200): { token, expiresIn, refreshToken, refreshExpiresAt }
   * Errors: 400 VALIDATION_ERROR, 401 REFRESH_TOKEN_INVALID | REFRESH_TOKEN_REUSED
   */
  async refresh(req: Request, res: Response): Promise<void> {
    const parsed = refreshBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid refresh request', 400, true, { code: 'VALIDATION_ERROR' });
    }
    const result = await authService.refresh(parsed.data.refreshToken);
    res.status(200).json(result);
  }

  /**
   * POST /api/v1/auth/logout
   * Revokes the refresh token family when a refreshToken is supplied.
   * Unauthenticated on purpose so an expired access token can still log out;
   * always 200 for a well-formed body (no token-validity oracle).
   */
  async logout(req: Request, res: Response): Promise<void> {
    const parsed = logoutBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError('Invalid logout request', 400, true, { code: 'VALIDATION_ERROR' });
    }
    if (parsed.data.refreshToken) {
      await revokeFamilyByToken(parsed.data.refreshToken, 'logout');
    }
    res.status(200).json({
      message: 'Logout successful',
    });
  }

  /**
   * GET /api/v1/auth/me
   * Get current user profile (requires auth)
   *
   * HEADERS:
   * Authorization: Bearer <token>
   *
   * RESPONSE (200):
   * {
   *   "id": "uuid",
   *   "email": "user@example.com",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "createdAt": "2024-01-01T00:00:00.000Z"
   * }
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    // req.user is set by auth middleware
    const userId = (req as any).user.id;

    const user = await authService.getUserById(userId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json(user);
  }
}

// Export singleton instance
export const authController = new AuthController();
