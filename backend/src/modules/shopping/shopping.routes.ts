/**
 * Shopping Routes
 *
 * API routes for the persistent shopping list.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/errorHandler';
import { ShoppingController } from './shopping.controller';

const router = Router();
const controller = new ShoppingController();

router.use(authenticate);

/**
 * @route   GET /api/v1/shopping/list
 * @desc    Get the user's active shopping list (created lazily)
 * @access  Private
 */
router.get('/list', asyncHandler(controller.getActiveList.bind(controller)));

export default router;
