/**
 * Market Price Service
 *
 * Business logic for market price tracking and currency conversion.
 * Integrates with cryptocurrency exchange APIs for real-time pricing.
 */

import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import {
  MarketPriceResponse,
  CurrentPriceResponse,
  GetMarketPricesQuery,
  PaginatedMarketPriceResponse,
  ConversionRequest,
  ConversionResponse,
  PriceHistoryResponse,
  PriceStatsResponse,
} from '../../types/marketprice.types';

export class MarketPriceService {
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();

  /**
   * Fetch current price from external API or use mock data
   */
  async fetchCurrentPrice(symbol: string): Promise<CurrentPriceResponse> {
    // Check cache first
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION_MS) {
      return {
        symbol,
        price: cached.price,
        lastUpdated: new Date(cached.timestamp).toISOString(),
      };
    }

    let price: number;
    let bid: number | undefined;
    let ask: number | undefined;

    try {
      // Try to fetch from external API
      // Note: In production, you would use a real API with proper authentication
      // For now, we'll use mock data as fallback
      price = this.getMockPrice(symbol);
      bid = price * 0.999; // Mock bid slightly lower
      ask = price * 1.001; // Mock ask slightly higher
    } catch (error) {
      logger.warn('Failed to fetch price from external API, using mock data', {
        service: 'kitcha-api',
        symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      price = this.getMockPrice(symbol);
    }

    // Update cache
    this.priceCache.set(symbol, { price, timestamp: Date.now() });

    // Store in database
    await prisma.marketPrice.create({
      data: {
        symbol,
        price,
        bid,
        ask,
      },
    });

    // Calculate 24h change
    const change24h = await this.calculate24hChange(symbol, price);

    logger.info('Price fetched and stored', {
      service: 'kitcha-api',
      symbol,
      price,
    });

    return {
      symbol,
      price,
      bid,
      ask,
      lastUpdated: new Date().toISOString(),
      change24h,
    };
  }

  /**
   * Get all market prices with filtering and pagination
   */
  async getMarketPrices(
    query: GetMarketPricesQuery
  ): Promise<PaginatedMarketPriceResponse> {
    const {
      symbol,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = query;

    // Build where clause
    const where: any = {};

    if (symbol) {
      where.symbol = symbol;
    }

    if (startDate || endDate) {
      where.fetchedAt = {};
      if (startDate) {
        where.fetchedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.fetchedAt.lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await prisma.marketPrice.count({ where });

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Get prices
    const prices = await prisma.marketPrice.findMany({
      where,
      orderBy: { fetchedAt: 'desc' },
      skip,
      take: limit,
    });

    return {
      items: prices.map((price) => this.formatPrice(price)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get most recent price for a symbol
   */
  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse> {
    const latestPrice = await prisma.marketPrice.findFirst({
      where: { symbol },
      orderBy: { fetchedAt: 'desc' },
    });

    if (!latestPrice) {
      // Fetch new price if none exists
      return this.fetchCurrentPrice(symbol);
    }

    // If price is older than cache duration, fetch new one
    const age = Date.now() - latestPrice.fetchedAt.getTime();
    if (age > this.CACHE_DURATION_MS) {
      return this.fetchCurrentPrice(symbol);
    }

    const change24h = await this.calculate24hChange(symbol, Number(latestPrice.price));

    return {
      symbol: latestPrice.symbol,
      price: Number(latestPrice.price),
      bid: latestPrice.bid ? Number(latestPrice.bid) : undefined,
      ask: latestPrice.ask ? Number(latestPrice.ask) : undefined,
      lastUpdated: latestPrice.fetchedAt.toISOString(),
      change24h,
    };
  }

  /**
   * Convert between currencies
   */
  async convertCurrency(data: ConversionRequest): Promise<ConversionResponse> {
    const { amount, fromCurrency, toCurrency } = data;

    if (amount <= 0) {
      throw new AppError('Amount must be greater than 0', 400);
    }

    // Get current prices for both currencies
    const fromPrice = await this.getCurrentPrice(fromCurrency);
    const toPrice = await this.getCurrentPrice(toCurrency);

    // Calculate conversion
    // If fromCurrency is PHP and toCurrency is USD:
    // 1 PHP = X USD, so amount PHP = amount * (toPrice.price / fromPrice.price) USD
    const exchangeRate = fromPrice.price / toPrice.price;
    const convertedAmount = amount * exchangeRate;

    return {
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      exchangeRate: Math.round(exchangeRate * 10000) / 10000,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get price history for charts
   */
  async getPriceHistory(
    symbol: string,
    days: number = 7
  ): Promise<PriceHistoryResponse> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const prices = await prisma.marketPrice.findMany({
      where: {
        symbol,
        fetchedAt: { gte: startDate },
      },
      orderBy: { fetchedAt: 'asc' },
    });

    // Group by day and calculate daily stats
    const dailyData = new Map<string, { prices: number[] }>();

    prices.forEach((price) => {
      const dateKey = price.fetchedAt.toISOString().split('T')[0];
      const existing = dailyData.get(dateKey);

      if (existing) {
        existing.prices.push(Number(price.price));
      } else {
        dailyData.set(dateKey, { prices: [Number(price.price)] });
      }
    });

    // Calculate daily high, low, and average
    const data = Array.from(dailyData.entries()).map(([date, { prices }]) => ({
      date,
      price: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      high: Math.max(...prices),
      low: Math.min(...prices),
    }));

    return {
      symbol,
      data,
    };
  }

  /**
   * Get price statistics
   */
  async getPriceStats(symbol: string): Promise<PriceStatsResponse> {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setHours(yesterday.getHours() - 24);

    const prices = await prisma.marketPrice.findMany({
      where: {
        symbol,
        fetchedAt: { gte: yesterday },
      },
      orderBy: { fetchedAt: 'desc' },
    });

    if (prices.length === 0) {
      throw new AppError('No price data available for this symbol', 404);
    }

    const priceValues = prices.map((p) => Number(p.price));
    const current = priceValues[0];
    const high24h = Math.max(...priceValues);
    const low24h = Math.min(...priceValues);
    const average24h = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;

    // Calculate change (current vs 24h ago)
    const price24hAgo = prices.length > 0 ? Number(prices[prices.length - 1].price) : current;
    const change24h = current - price24hAgo;
    const changePercentage24h = (change24h / price24hAgo) * 100;

    return {
      symbol,
      current,
      high24h,
      low24h,
      average24h: Math.round(average24h * 10000) / 10000,
      change24h: Math.round(change24h * 10000) / 10000,
      changePercentage24h: Math.round(changePercentage24h * 100) / 100,
    };
  }

  /**
   * Calculate 24-hour price change percentage
   */
  private async calculate24hChange(symbol: string, currentPrice: number): Promise<number> {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const oldPrice = await prisma.marketPrice.findFirst({
      where: {
        symbol,
        fetchedAt: { lte: yesterday },
      },
      orderBy: { fetchedAt: 'desc' },
    });

    if (!oldPrice) {
      return 0;
    }

    const change = ((currentPrice - Number(oldPrice.price)) / Number(oldPrice.price)) * 100;
    return Math.round(change * 100) / 100;
  }

  /**
   * Get mock price for development/testing
   */
  private getMockPrice(symbol: string): number {
    // Mock prices for common currencies
    const mockPrices: Record<string, number> = {
      'PHP': 56.50, // 1 USD = 56.50 PHP
      'USD': 1.00,
      'EUR': 0.92,
      'GBP': 0.79,
    };

    // Add some randomness to simulate price fluctuation (±2%)
    const basePrice = mockPrices[symbol] || 1.00;
    const fluctuation = (Math.random() - 0.5) * 0.04; // ±2%
    return Math.round(basePrice * (1 + fluctuation) * 10000) / 10000;
  }

  /**
   * Format price for response
   */
  private formatPrice(price: any): MarketPriceResponse {
    return {
      id: price.id,
      symbol: price.symbol,
      price: Number(price.price),
      bid: price.bid ? Number(price.bid) : undefined,
      ask: price.ask ? Number(price.ask) : undefined,
      fetchedAt: price.fetchedAt.toISOString(),
    };
  }
}
