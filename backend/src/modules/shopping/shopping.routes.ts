/**
 * Shopping Routes
 *
 * API routes for the persistent shopping list.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/errorHandler';
import { ShoppingController } from './shopping.controller';
import {
  validate,
  validateCreateItem,
  validateItemId,
  validateUpdateItem,
} from './shopping.validation';

const router = Router();
const controller = new ShoppingController();

router.use(authenticate);

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

export default router;
