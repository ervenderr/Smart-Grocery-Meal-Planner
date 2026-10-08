export interface CurrencyInfo {
  readonly code: string;
  readonly name: string;
}

/** Same order and codes as backend/src/constants/currencies.ts (parity-tested). */
export const SUPPORTED_CURRENCIES: ReadonlyArray<CurrencyInfo> = [
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'AED', name: 'UAE Dirham' },
];

export const SUPPORTED_CURRENCY_CODES: ReadonlyArray<string> = SUPPORTED_CURRENCIES.map(
  (c) => c.code
);

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCY_CODES.includes(code);
}
