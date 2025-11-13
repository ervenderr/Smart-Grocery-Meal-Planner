/**
 * Pantry Routes
 *
 * API routes for pantry management.
 */

import { Router } from 'express';
import { PantryController } from './pantry.controller';
import { authenticate } from '../../middleware/auth.middleware';
import {
  validateCreateItem,
  validateUpdateItem,
  validateGetItems,
  validateItemId,
  validate,
} from './pantry.validation';

const router = Router();
const pantryController = new PantryController();

/**
 * All pantry routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/v1/pantry/stats
 * @desc    Get pantry statistics
 * @access  Private
 */
router.get('/stats', pantryController.getStats);

/**
 * @route   POST /api/v1/pantry
 * @desc    Create a new pantry item
 * @access  Private
 */
router.post('/', validateCreateItem, validate, pantryController.createItem);

/**
 * @route   GET /api/v1/pantry
 * @desc    Get all pantry items (with filtering and pagination)
 * @access  Private
 */
router.get('/', validateGetItems, validate, pantryController.getItems);

/**
 * @route   GET /api/v1/pantry/:id
 * @desc    Get a single pantry item by ID
 * @access  Private
 */
router.get('/:id', validateItemId, validate, pantryController.getItemById);

/**
 * @route   PATCH /api/v1/pantry/:id
 * @desc    Update a pantry item
 * @access  Private
 */
router.patch(
  '/:id',
  validateUpdateItem,
  validate,
  pantryController.updateItem
);

/**
 * @route   DELETE /api/v1/pantry/:id
 * @desc    Delete a pantry item
 * @access  Private
 */
router.delete('/:id', validateItemId, validate, pantryController.deleteItem);

export default router;
