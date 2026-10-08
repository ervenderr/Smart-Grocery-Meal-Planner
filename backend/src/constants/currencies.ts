/**
 * Supported currency codes (single backend source of truth).
 *
 * The frontend parity test parses this file, so keep it a string-literal
 * array with one code per line.
 */
export const SUPPORTED_CURRENCIES = [
  'PHP',
  'USD',
  'EUR',
  'GBP',
  'SGD',
  'JPY',
  'AUD',
  'CAD',
  'HKD',
  'INR',
  'KRW',
  'MYR',
  'THB',
  'IDR',
  'NZD',
  'AED',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
