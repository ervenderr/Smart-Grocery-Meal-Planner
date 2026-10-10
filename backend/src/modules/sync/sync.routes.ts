/**
 * Sync Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/errorHandler';
import { syncLimiter } from '../../middleware/rateLimiter';
import { getBootstrap } from './sync.controller';

const router = Router();

router.use(authenticate);
router.use(syncLimiter);

/**
 * @route   GET /api/v1/sync/bootstrap
 * @desc    Keyset-paged snapshot (pantry, shopping list, recipes, meal plans)
 */
router.get('/bootstrap', asyncHandler(getBootstrap));

export default router;
