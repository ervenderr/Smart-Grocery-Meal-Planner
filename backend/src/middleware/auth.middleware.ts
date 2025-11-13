/**
 * JWT Authentication Middleware
 *
 * Protects routes by verifying JWT tokens.
 *
 * HOW IT WORKS:
 * 1. Extract token from Authorization header
 * 2. Verify token (check signature, expiration)
 * 3. Get user from database
 * 4. Attach user to request object
 * 5. Call next() to continue to route handler
 *
 * USAGE:
 * router.get('/profile', authenticate, (req, res) => {
 *   const userId = req.user.id; // User is now available!
 * });
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { verifyToken, extractTokenFromHeader } from '@/utils/jwt.util';
import { authService } from '@/modules/auth/auth.service';
import { logger } from '@/config/logger.config';

/**
 * Middleware: Require authentication
 *
 * Place this middleware on any route that requires login.
 *
 * WHAT IT DOES:
 * - Checks for Authorization header
 * - Verifies JWT token
 * - Loads user from database
 * - Attaches user to req.user
 * - Throws error if anything fails
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      throw new AppError('No token provided', 401);
    }

    // 2. Verify token (checks signature and expiration)
    let payload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      // Token is invalid or expired
      throw new AppError('Invalid or expired token', 401);
    }

    // 3. Get user from database (ensure user still exists)
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      throw new AppError('User not found', 401);
    }

    // 4. Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    // 5. Attach user to request object
    // Now other middlewares/controllers can access req.user
    (req as any).user = {
      id: user.id,
      email: user.email,
    };

    // 6. Continue to next middleware/route handler
    next();
  } catch (error) {
    // Pass error to global error handler
    next(error);
  }
}

/**
 * Middleware: Optional authentication
 *
 * Similar to authenticate(), but doesn't fail if no token.
 * Useful for routes that work differently for logged-in users.
 *
 * EXAMPLE USE CASE:
 * Public recipe list, but logged-in users see their favorites.
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    // No token? That's okay, just continue
    if (!token) {
      return next();
    }

    // Token exists, try to verify it
    try {
      const payload = verifyToken(token);
      const user = await authService.getUserById(payload.userId);

      if (user && user.isActive) {
        (req as any).user = {
          id: user.id,
          email: user.email,
        };
      }
    } catch (error) {
      // Token invalid - just log and continue without user
      logger.debug('Optional auth failed', { error });
    }

    next();
  } catch (error) {
    next(error);
  }
}
