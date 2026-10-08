/**
 * Shopping Routes
 *
 * API routes for the persistent shopping list.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { shoppingLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../middleware/errorHandler';
import { ShoppingController } from './shopping.controller';
import {
  validate,
  validateCreateItem,
  validateFinish,
  validateGenerate,
  validateHistory,
  validateItemId,
  validateUpdateItem,
} from './shopping.validation';

const router = Router();
const controller = new ShoppingController();

router.use(authenticate);
router.use(shoppingLimiter);

/**
 * @route   GET /api/v1/shopping/list
 * @desc    Get the user's active shopping list (created lazily)
 * @access  Private
 */
router.get('/list', asyncHandler(controller.getActiveList.bind(controller)));

/**
 * @route   POST /api/v1/shopping/items
 * @desc    Add an item to the active list (created lazily)
 * @access  Private
 */
router.post(
  '/items',
  validateCreateItem,
  validate,
  asyncHandler(controller.addItem.bind(controller)),
);

/**
 * @route   PATCH /api/v1/shopping/items/:itemId
 * @desc    Edit or check/uncheck an item on the active list
 * @access  Private
 */
router.patch(
  '/items/:itemId',
  validateItemId,
  validateUpdateItem,
  validate,
  asyncHandler(controller.updateItem.bind(controller)),
);

/**
 * @route   DELETE /api/v1/shopping/items/:itemId
 * @desc    Remove an item from the active list
 * @access  Private
 */
router.delete(
  '/items/:itemId',
  validateItemId,
  validate,
  asyncHandler(controller.deleteItem.bind(controller)),
);

/**
 * @route   POST /api/v1/shopping/generate
 * @desc    Merge a meal plan's ingredients into the active list
 * @access  Private
 */
router.post(
  '/generate',
  validateGenerate,
  validate,
  asyncHandler(controller.generate.bind(controller)),
);

/**
 * @route   POST /api/v1/shopping/finish
 * @desc    Complete the active list into history; carry over or discard unchecked items
 * @access  Private
 */
router.post(
  '/finish',
  validateFinish,
  validate,
  asyncHandler(controller.finish.bind(controller)),
);

/**
 * @route   GET /api/v1/shopping/history
 * @desc    Completed trips, newest first (paginated)
 * @access  Private
 */
router.get(
  '/history',
  validateHistory,
  validate,
  asyncHandler(controller.history.bind(controller)),
);

export default router;
