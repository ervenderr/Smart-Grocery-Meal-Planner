/**
 * Analytics Controller
 *
 * HTTP request handlers for analytics endpoints.
 */

import { Request, Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  SpendingTrendsQuery,
  CategoryBreakdownQuery,
  TopItemsQuery,
  BudgetComparisonQuery,
  PriceTrendsQuery,
} from '../../types/analytics.types';

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Get analytics dashboard
   * GET /api/v1/analytics/dashboard
   */
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const dashboard = await this.analyticsService.getDashboard(userId);
    res.status(200).json(dashboard);
  });

  /**
   * Get spending trends
   * GET /api/v1/analytics/spending-trends
   */
  getSpendingTrends = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const query: SpendingTrendsQuery = {
      period: (req.query.period as 'daily' | 'weekly' | 'monthly') || 'weekly',
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const trends = await this.analyticsService.getSpendingTrends(userId, query);
    res.status(200).json(trends);
  });

  /**
   * Get category breakdown
   * GET /api/v1/analytics/category-breakdown
   */
  getCategoryBreakdown = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const query: CategoryBreakdownQuery = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      minAmount: req.query.minAmount ? parseInt(req.query.minAmount as string) : undefined,
    };

    const breakdown = await this.analyticsService.getCategoryBreakdown(userId, query);
    res.status(200).json(breakdown);
  });

  /**
   * Get top items
   * GET /api/v1/analytics/top-items
   */
  getTopItems = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const query: TopItemsQuery = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      sortBy: (req.query.sortBy as 'quantity' | 'spending' | 'frequency') || 'spending',
    };

    const topItems = await this.analyticsService.getTopItems(userId, query);
    res.status(200).json(topItems);
  });

  /**
   * Get budget comparison
   * GET /api/v1/analytics/budget-comparison
   */
  getBudgetComparison = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const query: BudgetComparisonQuery = {
      period: (req.query.period as 'weekly' | 'monthly' | 'yearly') || 'weekly',
      count: req.query.count ? parseInt(req.query.count as string) : undefined,
    };

    const comparison = await this.analyticsService.getBudgetComparison(userId, query);
    res.status(200).json(comparison);
  });

  /**
   * Get price trends
   * GET /api/v1/analytics/price-trends
   */
  getPriceTrends = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const query: PriceTrendsQuery = {
      ingredientName: req.query.ingredientName as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: (req.query.period as 'daily' | 'weekly' | 'monthly') || 'weekly',
    };

    const priceTrends = await this.analyticsService.getPriceTrends(userId, query);
    res.status(200).json(priceTrends);
  });

  /**
   * Get savings insights
   * GET /api/v1/analytics/savings-insights
   */
  getSavingsInsights = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const insights = await this.analyticsService.getSavingsInsights(userId);
    res.status(200).json(insights);
  });
}
