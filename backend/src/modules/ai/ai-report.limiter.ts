/**
 * Per-user hourly limiter for AI content reports.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';

const AI_REPORT_WINDOW_MS = 60 * 60 * 1000;
const AI_REPORT_DEFAULT_LIMIT = 5;
export const AI_REPORT_RATE_LIMIT_MESSAGE =
  "You've sent several reports recently. Try again later.";

export const createAiReportLimiter = (limit: number = AI_REPORT_DEFAULT_LIMIT) =>
  rateLimit({
    windowMs: AI_REPORT_WINDOW_MS,
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
        code: 'AI_REPORT_RATE_LIMITED',
        message: AI_REPORT_RATE_LIMIT_MESSAGE,
        error: AI_REPORT_RATE_LIMIT_MESSAGE,
      });
    },
  });

export const aiReportLimiter = createAiReportLimiter();
