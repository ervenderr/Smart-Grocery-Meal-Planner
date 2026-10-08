/**
 * Rate Limiting Middleware
 *
 * Protects against brute force attacks, DDoS, and API abuse.
 *
 * LIMITS:
 * - General API: 100 requests per 15 minutes per IP
 * - Auth endpoints: 5 attempts per 15 minutes per IP
 * - AI endpoints: 10 requests per minute per user (burst limit; the daily cap
 *   is enforced by the DB quota, not here)
 *
 * WHY RATE LIMITING?
 * - Prevents brute force password attacks
 * - Protects against DDoS
 * - Prevents API abuse
 * - Reduces server costs from automated attacks
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * General API rate limiter
 * Applied to all API routes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for successful requests in some cases
  skipSuccessfulRequests: false,
  // Custom handler for rate limit exceeded
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many requests from this IP, please try again after 15 minutes',
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force login/registration attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts per 15 minutes
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't count successful requests against the limit
  skipSuccessfulRequests: true,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many authentication attempts, please try again after 15 minutes',
    });
  },
});

const AI_RATE_LIMIT_MESSAGE = 'Too many AI requests. Please wait a minute and try again.';

/**
 * AI endpoint burst limiter
 * 10 requests per minute per authenticated user. Keyed by user id (set by
 * authenticate from the JWT); falls back to an IPv6-safe IP key.
 */
export const aiBurstLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    return userId ?? ipKeyGenerator(req.ip ?? '');
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      code: 'AI_RATE_LIMITED',
      message: AI_RATE_LIMIT_MESSAGE,
      error: AI_RATE_LIMIT_MESSAGE,
    });
  },
});

/**
 * Password reset rate limiter
 * Prevents abuse of password reset functionality
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset requests per hour
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many password reset attempts, please try again after 1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many password reset attempts, please try again after 1 hour',
    });
  },
});
