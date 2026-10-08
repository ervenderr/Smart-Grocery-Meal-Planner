/**
 * Food lookup routes (Open Food Facts barcode, USDA nutrition).
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/errorHandler';
import { getBarcode, getNutrition } from './food.controller';
import { validate, validateBarcode, validateNutritionQuery } from './food.validation';

const router = Router();

router.use(authenticate);

router.get('/barcode/:code', validateBarcode, validate, asyncHandler(getBarcode));
router.get('/nutrition', validateNutritionQuery, validate, asyncHandler(getNutrition));

export default router;
