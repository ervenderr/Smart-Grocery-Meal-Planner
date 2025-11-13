/**
 * Market Price Routes
 *
 * API routes for market price tracking and currency conversion.
 */

import { Router } from 'express';
import { MarketPriceController } from './marketprice.controller';
import { authenticate } from '../../middleware/auth.middleware';
import {
  validateFetchPrice,
  validateConversion,
  validateGetMarketPrices,
  validateSymbol,
  validatePriceHistory,
  validate,
} from './marketprice.validation';

const router = Router();
const priceController = new MarketPriceController();

// All price routes require authentication
router.use(authenticate);

// Fetch current price and store
router.post(
  '/fetch',
  validateFetchPrice,
  validate,
  priceController.fetchPrice
);

// Currency conversion
router.post(
  '/convert',
  validateConversion,
  validate,
  priceController.convertCurrency
);

// Get all prices with filtering
router.get(
  '/',
  validateGetMarketPrices,
  validate,
  priceController.getMarketPrices
);

// Get current price for a symbol
router.get(
  '/:symbol/current',
  validateSymbol,
  validate,
  priceController.getCurrentPrice
);

// Get price history
router.get(
  '/:symbol/history',
  validatePriceHistory,
  validate,
  priceController.getPriceHistory
);

// Get price statistics
router.get(
  '/:symbol/stats',
  validateSymbol,
  validate,
  priceController.getPriceStats
);

export default router;
