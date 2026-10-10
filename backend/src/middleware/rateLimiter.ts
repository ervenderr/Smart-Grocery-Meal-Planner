/**
 * Rate Limiting Middleware
 *
 * Protects against brute force attacks, DDoS, and API abuse.
 *
 * LIMITS:
 * - General API: 100 requests per 15 minutes per IP
 * - Auth endpoints: 5 attempts per 15 minutes per IP
 * - Shopping endpoints: 600 requests per 15 minutes per user (the general API
 *   limiter skips /api/<version>/shopping ONLY for requests carrying a valid
 *   JWT, so aisle check-offs are not throttled while unauthenticated or
 *   bad-token floods still hit the per-IP general limit)
 * - Pantry: 600 per 15 minutes per user; Sync: 300 per 15 minutes per user.
 *   Same JWT-gated skip, so offline queue drains and bootstrap page loops are
 *   not throttled by the per-IP limiter.
 * - Refresh/logout: 30 per 15 minutes per IP (failures only)
 * - Notification stats (GET /api/<version>/notifications/stats): 300 requests
 *   per 15 minutes per user. Same JWT-gated skip as shopping, because the
 *   frontend polls this read-only unread count from every open tab.
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
import { config } from '../config/env.config';
import {
  SHOPPING_RATE_LIMIT_MAX,
  SHOPPING_RATE_LIMIT_WINDOW_MS,
} from '../modules/shopping/shopping.constants';
import { extractTokenFromHeader, verifyToken } from '../utils/jwt.util';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SHOPPING_PATH_PATTERN = new RegExp(
  `^/api/${escapeRegExp(config.apiVersion)}/shopping(/|\\?|$)`,
);

const USER_SCOPED_PATH_PATTERN = new RegExp(
  `^/api/${escapeRegExp(config.apiVersion)}/(shopping|pantry|sync)(/|\\?|$)`,
);

/** True for shopping, pantry and sync paths (per-user limited; matches originalUrl). */
export const isUserScopedApiRequest = (originalUrl: string): boolean =>
  USER_SCOPED_PATH_PATTERN.test(originalUrl);

/** True for /api/<version>/shopping and anything beneath it (matches originalUrl). */
export const isShoppingRequest = (originalUrl: string): boolean =>
  SHOPPING_PATH_PATTERN.test(originalUrl);

const NOTIFICATION_STATS_PATH_PATTERN = new RegExp(
  `^/api/${escapeRegExp(config.apiVersion)}/notifications/stats/?(\\?.*)?$`,
);

export const NOTIFICATION_STATS_RATE_LIMIT_MAX = 300;
const NOTIFICATION_STATS_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** True only for the read-only GET /api/<version>/notifications/stats poll. */
export const isNotificationStatsRequest = (method: string, originalUrl: string): boolean =>
  method === 'GET' && NOTIFICATION_STATS_PATH_PATTERN.test(originalUrl);

/** True when the request carries a bearer token with a valid signature and expiry. */
export const hasValidBearerToken = (req: Request): boolean => {
  const token = extractTokenFromHeader(req.headers.authorization);
  if (!token) return false;
  try {
    verifyToken(token);
    return true;
  } catch {
    return false;
  }
};

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
  // Mounted at '/api/', so req.path is relative; match on originalUrl.
  // Shopping has its own per-user limiter, but only for requests with a valid
  // token; unauthenticated traffic stays under this per-IP limit.
  skip: (req: Request) =>
    (isUserScopedApiRequest(req.originalUrl) ||
      isNotificationStatsRequest(req.method, req.originalUrl)) &&
    hasValidBearerToken(req),
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

const SHOPPING_RATE_LIMIT_MESSAGE = 'Too many shopping list requests. Please wait a moment and try again.';

export const PANTRY_RATE_LIMIT_MAX = 600;
export const SYNC_RATE_LIMIT_MAX = 300;
const USER_SCOPED_WINDOW_MS = 15 * 60 * 1000;

/** Per-user limiter (keyed by user id; IPv6-safe IP fallback). */
export const createUserScopedLimiter = (opts: {
  limit: number;
  windowMs?: number;
  code: string;
  message: string;
}) =>
  rateLimit({
    windowMs: opts.windowMs ?? USER_SCOPED_WINDOW_MS,
    limit: opts.limit,
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
        code: opts.code,
        message: opts.message,
        error: opts.message,
      });
    },
  });

/** Per-user shopping limiter. */
export const createShoppingLimiter = (limit: number = SHOPPING_RATE_LIMIT_MAX) =>
  createUserScopedLimiter({
    limit,
    windowMs: SHOPPING_RATE_LIMIT_WINDOW_MS,
    code: 'SHOPPING_RATE_LIMITED',
    message: SHOPPING_RATE_LIMIT_MESSAGE,
  });

export const shoppingLimiter = createShoppingLimiter();

export const createPantryLimiter = (limit: number = PANTRY_RATE_LIMIT_MAX) =>
  createUserScopedLimiter({
    limit,
    code: 'PANTRY_RATE_LIMITED',
    message: 'Too many pantry requests. Please wait a moment and try again.',
  });

export const pantryLimiter = createPantryLimiter();

export const createSyncLimiter = (limit: number = SYNC_RATE_LIMIT_MAX) =>
  createUserScopedLimiter({
    limit,
    code: 'SYNC_RATE_LIMITED',
    message: 'Too many sync requests. Please wait a moment and try again.',
  });

export const syncLimiter = createSyncLimiter();

const REFRESH_RATE_LIMIT_MESSAGE = 'Too many token refresh attempts. Please try again later.';

/** IP-keyed limiter for /auth/refresh and /auth/logout (failed requests only count). */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      code: 'AUTH_REFRESH_RATE_LIMITED',
      message: REFRESH_RATE_LIMIT_MESSAGE,
      error: REFRESH_RATE_LIMIT_MESSAGE,
    });
  },
});

const NOTIFICATION_STATS_RATE_LIMIT_MESSAGE =
  'Too many notification checks. Please wait a moment and try again.';

/** Per-user limiter for the notification unread-count poll (IPv6-safe IP fallback). */
export const createNotificationStatsLimiter = (limit: number = NOTIFICATION_STATS_RATE_LIMIT_MAX) =>
  rateLimit({
    windowMs: NOTIFICATION_STATS_RATE_LIMIT_WINDOW_MS,
    limit,
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
        code: 'NOTIFICATION_RATE_LIMITED',
        message: NOTIFICATION_STATS_RATE_LIMIT_MESSAGE,
        error: NOTIFICATION_STATS_RATE_LIMIT_MESSAGE,
      });
    },
  });

export const notificationStatsLimiter = createNotificationStatsLimiter();

const FOOD_RATE_LIMIT_MESSAGE = 'Too many product lookups. Please wait a minute and try again.';

/**
 * Food lookup burst limiter: 20 requests per minute per authenticated user so
 * one account cannot saturate the shared outbound (Open Food Facts / USDA)
 * throttle or flood the cache table.
 */
export const foodBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
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
      code: 'FOOD_RATE_LIMITED',
      message: FOOD_RATE_LIMIT_MESSAGE,
      error: FOOD_RATE_LIMIT_MESSAGE,
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
