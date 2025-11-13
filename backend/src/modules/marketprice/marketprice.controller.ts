/**
 * Market Price Controller
 *
 * HTTP request handlers for market price endpoints.
 */

import { Request, Response } from 'express';
import { MarketPriceService } from './marketprice.service';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  GetMarketPricesQuery,
  ConversionRequest,
} from '../../types/marketprice.types';

export class MarketPriceController {
  private marketPriceService: MarketPriceService;

  constructor() {
    this.marketPriceService = new MarketPriceService();
  }

  /**
   * Fetch and store current price
   * POST /api/v1/prices/fetch
   */
  fetchPrice = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.body;

    const price = await this.marketPriceService.fetchCurrentPrice(symbol);
    res.status(200).json(price);
  });

  /**
   * Get all market prices
   * GET /api/v1/prices
   */
  getMarketPrices = asyncHandler(async (req: Request, res: Response) => {
    const query: GetMarketPricesQuery = {
      symbol: req.query.symbol as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await this.marketPriceService.getMarketPrices(query);
    res.status(200).json(result);
  });

  /**
   * Get current price for a symbol
   * GET /api/v1/prices/:symbol/current
   */
  getCurrentPrice = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;

    const price = await this.marketPriceService.getCurrentPrice(symbol);
    res.status(200).json(price);
  });

  /**
   * Convert between currencies
   * POST /api/v1/prices/convert
   */
  convertCurrency = asyncHandler(async (req: Request, res: Response) => {
    const data: ConversionRequest = req.body;

    const result = await this.marketPriceService.convertCurrency(data);
    res.status(200).json(result);
  });

  /**
   * Get price history
   * GET /api/v1/prices/:symbol/history
   */
  getPriceHistory = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const days = req.query.days ? parseInt(req.query.days as string) : 7;

    const history = await this.marketPriceService.getPriceHistory(symbol, days);
    res.status(200).json(history);
  });

  /**
   * Get price statistics
   * GET /api/v1/prices/:symbol/stats
   */
  getPriceStats = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;

    const stats = await this.marketPriceService.getPriceStats(symbol);
    res.status(200).json(stats);
  });
}
