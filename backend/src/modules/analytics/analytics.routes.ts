/**
 * Analytics Routes
 *
 * API routes for analytics and reporting.
 */

import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';
import {
  validateSpendingTrends,
  validateCategoryBreakdown,
  validateTopItems,
  validateBudgetComparison,
  validatePriceTrends,
  validate,
} from './analytics.validation';

const router = Router();
const analyticsController = new AnalyticsController();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get analytics dashboard with summary
 * @access  Private
 */
router.get('/dashboard', analyticsController.getDashboard);

/**
 * @route   GET /api/v1/analytics/spending-trends
 * @desc    Get spending trends over time
 * @access  Private
 */
router.get(
  '/spending-trends',
  validateSpendingTrends,
  validate,
  analyticsController.getSpendingTrends
);

/**
 * @route   GET /api/v1/analytics/category-breakdown
 * @desc    Get category spending breakdown
 * @access  Private
 */
router.get(
  '/category-breakdown',
  validateCategoryBreakdown,
  validate,
  analyticsController.getCategoryBreakdown
);

/**
 * @route   GET /api/v1/analytics/top-items
 * @desc    Get top items by spending/quantity/frequency
 * @access  Private
 */
router.get(
  '/top-items',
  validateTopItems,
  validate,
  analyticsController.getTopItems
);

/**
 * @route   GET /api/v1/analytics/budget-comparison
 * @desc    Get budget comparison over periods
 * @access  Private
 */
router.get(
  '/budget-comparison',
  validateBudgetComparison,
  validate,
  analyticsController.getBudgetComparison
);

/**
 * @route   GET /api/v1/analytics/price-trends
 * @desc    Get price trends for ingredients
 * @access  Private
 */
router.get(
  '/price-trends',
  validatePriceTrends,
  validate,
  analyticsController.getPriceTrends
);

/**
 * @route   GET /api/v1/analytics/savings-insights
 * @desc    Get savings insights and recommendations
 * @access  Private
 */
router.get('/savings-insights', analyticsController.getSavingsInsights);

export default router;
