/**
 * Market Price Types
 *
 * Type definitions for market price tracking and currency conversion.
 * Tracks cryptocurrency prices (e.g., Gemini exchange) for budget tracking.
 */

/**
 * Supported currency symbols
 */
export enum CurrencySymbol {
  PHP = 'PHP',
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
}

/**
 * Market price response
 */
export interface MarketPriceResponse {
  id: string;
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  fetchedAt: string;
}

/**
 * Current market price (most recent)
 */
export interface CurrentPriceResponse {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  lastUpdated: string;
  change24h?: number; // Percentage change in last 24 hours
}

/**
 * Query parameters for getting market prices
 */
export interface GetMarketPricesQuery {
  symbol?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Paginated market price response
 */
export interface PaginatedMarketPriceResponse {
  items: MarketPriceResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Currency conversion request
 */
export interface ConversionRequest {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
}

/**
 * Currency conversion response
 */
export interface ConversionResponse {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  exchangeRate: number;
  timestamp: string;
}

/**
 * Price history for charts
 */
export interface PriceHistoryResponse {
  symbol: string;
  data: Array<{
    date: string;
    price: number;
    high?: number;
    low?: number;
  }>;
}

/**
 * Price statistics
 */
export interface PriceStatsResponse {
  symbol: string;
  current: number;
  high24h: number;
  low24h: number;
  average24h: number;
  change24h: number;
  changePercentage24h: number;
}

/**
 * External API response from cryptocurrency exchange
 */
export interface ExternalPriceAPIResponse {
  symbol: string;
  price: string;
  bid?: string;
  ask?: string;
  timestamp: number;
}
