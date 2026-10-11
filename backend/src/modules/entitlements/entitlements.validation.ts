/**
 * Boundary validation for the entitlements endpoints.
 */

import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';

export const MAX_SIGNED_TRANSACTION_LENGTH = 16384;

export const verifyBodySchema = z
  .object({ signedTransaction: z.string().min(20).max(MAX_SIGNED_TRANSACTION_LENGTH) })
  .strict();

export type VerifyBody = z.infer<typeof verifyBodySchema>;

/** Parses the body; never echoes input values back (the JWS is sensitive). */
export function validateVerifyBody(req: Request, _res: Response, next: NextFunction): void {
  const parsed = verifyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'body'))].join(', ');
    throw new AppError(`Validation failed: invalid ${fields}`, 400, true, { code: 'VALIDATION_ERROR' });
  }
  req.body = parsed.data;
  next();
}
