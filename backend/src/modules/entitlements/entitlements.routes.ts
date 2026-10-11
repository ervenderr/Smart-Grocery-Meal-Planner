/**
 * Entitlement routes: verify a StoreKit 2 transaction and read status/limits.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/errorHandler';
import { idempotency } from '../../middleware/idempotency.middleware';
import { createUserScopedLimiter } from '../../middleware/rateLimiter';
import { me, verify } from './entitlements.controller';
import { validateVerifyBody } from './entitlements.validation';

const VERIFY_LIMIT_PER_WINDOW = 30;

const entitlementLimiter = createUserScopedLimiter({
  limit: VERIFY_LIMIT_PER_WINDOW,
  code: 'ENTITLEMENT_RATE_LIMITED',
  message: 'Too many purchase checks. Please wait a moment and try again.',
});

const router = Router();

router.use(authenticate);

/** GET /api/v1/entitlements/me */
router.get('/me', asyncHandler(me));

/** POST /api/v1/entitlements/verify (restore re-sends the current entitlement JWS) */
router.post('/verify', entitlementLimiter, idempotency, validateVerifyBody, asyncHandler(verify));

export default router;
