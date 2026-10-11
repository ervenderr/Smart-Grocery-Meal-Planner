/**
 * Public App Store Server Notifications V2 webhook. No user auth: the signed
 * payload (Apple chain, bundle id, environment) is verified in the service.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { createUserScopedLimiter } from '../../middleware/rateLimiter';
import { handleAppStoreNotification } from './notifications.service';
import { validateNotificationBody, type NotificationBody } from './notifications.validation';

const WEBHOOK_LIMIT_PER_MINUTE = 120;
const ONE_MINUTE_MS = 60 * 1000;

// No user is attached on this route, so the limiter keys on the client IP.
const webhookLimiter = createUserScopedLimiter({
  limit: WEBHOOK_LIMIT_PER_MINUTE,
  windowMs: ONE_MINUTE_MS,
  code: 'WEBHOOK_RATE_LIMITED',
  message: 'Too many webhook requests.',
});

async function receive(req: Request, res: Response): Promise<void> {
  const { signedPayload } = req.body as NotificationBody;
  await handleAppStoreNotification(signedPayload);
  res.status(200).json({});
}

const router = Router();

/** POST /api/v1/webhooks/app-store */
router.post('/', webhookLimiter, validateNotificationBody, asyncHandler(receive));

export default router;
