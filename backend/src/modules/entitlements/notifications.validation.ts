/**
 * Boundary validation for the App Store Server Notifications webhook.
 * Non-strict on purpose: Apple may add top-level fields later.
 */

import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';

export const MAX_SIGNED_PAYLOAD_LENGTH = 65536;

export const notificationBodySchema = z.object({
  signedPayload: z.string().min(20).max(MAX_SIGNED_PAYLOAD_LENGTH),
});

export type NotificationBody = z.infer<typeof notificationBodySchema>;

/** Parses the body; never echoes the payload back. */
export function validateNotificationBody(req: Request, _res: Response, next: NextFunction): void {
  const parsed = notificationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError('Validation failed: invalid signedPayload', 400, true, { code: 'VALIDATION_ERROR' });
  }
  req.body = parsed.data;
  next();
}
