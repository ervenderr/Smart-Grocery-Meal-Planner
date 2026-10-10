/**
 * Brute-force limiter for DELETE /users/me: failed attempts only, per user.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';

const WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 5;
const RATE_LIMIT_CODE = 'ACCOUNT_DELETE_RATE_LIMITED';
const RATE_LIMIT_MESSAGE = 'Too many attempts. Try again later.';

export function createAccountDeletionLimiter(limit: number = DEFAULT_LIMIT) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) =>
      (req as Request & { user?: { id?: string } }).user?.id ?? ipKeyGenerator(req.ip ?? ''),
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        status: 'error',
        statusCode: 429,
        code: RATE_LIMIT_CODE,
        message: RATE_LIMIT_MESSAGE,
        error: RATE_LIMIT_MESSAGE,
      });
    },
  });
}

export const accountDeletionLimiter = createAccountDeletionLimiter();
