/**
 * Cook Routes: "Cooked it" preview and apply.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/errorHandler';
import { CookController } from './cook.controller';
import { validate, validateApply, validatePreview } from './cook.validation';

const router = Router();
const controller = new CookController();

router.use(authenticate);

/**
 * @route   POST /api/v1/cook/preview
 * @desc    Preview pantry deductions for cooking a recipe
 * @access  Private
 */
router.post('/preview', validatePreview, validate, asyncHandler(controller.preview.bind(controller)));

/**
 * @route   POST /api/v1/cook/apply
 * @desc    Apply confirmed pantry deductions
 * @access  Private
 */
router.post('/apply', validateApply, validate, asyncHandler(controller.apply.bind(controller)));

export default router;
