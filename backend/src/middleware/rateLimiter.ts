/**
 * Rate Limiting Middleware
 *
 * Protects against brute force attacks, DDoS, and API abuse.
 *
 * LIMITS:
 * - General API: 100 requests per 15 minutes per IP
 * - Auth endpoints: 5 attempts per 15 minutes per IP
 * - AI endpoints: 10 requests per hour per user (expensive operations)
 *
 * WHY RATE LIMITING?
 * - Prevents brute force password attacks
 * - Protects against DDoS
 * - Prevents API abuse
 * - Reduces server costs from automated attacks
 */

import rateLimit from 'express-rate-limit';
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

/**
 * AI endpoint rate limiter
 * Prevents abuse of expensive AI operations
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 AI requests per hour
  message: {
    status: 'error',
    statusCode: 429,
    message: 'AI request limit reached. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID for rate limiting instead of IP (more accurate for logged-in users)
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return (req as any).user?.id || req.ip || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'AI request limit reached. Please try again in an hour.',
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
