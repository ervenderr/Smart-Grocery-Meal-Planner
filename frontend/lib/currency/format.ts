import { SUPPORTED_CURRENCIES, isSupportedCurrency } from './currencies';

export const DEFAULT_CURRENCY = 'PHP';
/** Pinned so server and client render identical strings (no hydration mismatch). */
export const FORMAT_LOCALE = 'en-US';

type Variant = 'full' | 'compact' | 'symbol';

const formatterCache = new Map<string, Intl.NumberFormat>();

function buildFormatter(code: string, variant: Variant): Intl.NumberFormat {
  switch (variant) {
    case 'compact':
      return new Intl.NumberFormat(FORMAT_LOCALE, {
        style: 'currency',
        currency: code,
        notation: 'compact',
      });
    case 'symbol':
      return new Intl.NumberFormat(FORMAT_LOCALE, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
      });
    default:
      return new Intl.NumberFormat(FORMAT_LOCALE, { style: 'currency', currency: code });
  }
}

function getFormatter(currency: string, variant: Variant): Intl.NumberFormat {
  const code = isSupportedCurrency(currency) ? currency : DEFAULT_CURRENCY;
  const key = `${code}:${variant}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  let formatter: Intl.NumberFormat;
  try {
    formatter = buildFormatter(code, variant);
  } catch {
    formatter = buildFormatter(DEFAULT_CURRENCY, variant);
  }
  formatterCache.set(key, formatter);
  return formatter;
}

/** Format integer minor units (value x 100) in the given currency. */
export function formatCurrency(cents: number, currency: string = DEFAULT_CURRENCY): string {
  return getFormatter(currency, 'full').format(cents / 100);
}

export function formatCurrencyCompact(
  cents: number,
  currency: string = DEFAULT_CURRENCY
): string {
  return getFormatter(currency, 'compact').format(cents / 100);
}

export function currencySymbol(code: string): string {
  const part = getFormatter(code, 'symbol')
    .formatToParts(0)
    .find((p) => p.type === 'currency');
  return part?.value ?? code;
}

export function currencyOptionLabel(code: string): string {
  const name = SUPPORTED_CURRENCIES.find((c) => c.code === code)?.name ?? code;
  return `${code} - ${name} (${currencySymbol(code)})`;
}

/** Number of decimal digits users may type for a currency (JPY/KRW: 0). */
export function currencyFractionDigits(currency: string = DEFAULT_CURRENCY): number {
  const code = isSupportedCurrency(currency) ? currency : DEFAULT_CURRENCY;
  try {
    return (
      new Intl.NumberFormat(FORMAT_LOCALE, { style: 'currency', currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * Parse a plain decimal major-unit string ("12.34") to integer cents.
 *
 * Works on the digits themselves (no float math) and rejects hex, exponent,
 * signs, separators, whitespace inside the number, and more fraction digits
 * than the currency allows. Returns null when invalid.
 */
export function parseMajorToCents(
  input: string,
  currency: string = DEFAULT_CURRENCY
): number | null {
  const digits = currencyFractionDigits(currency);
  const pattern = new RegExp(`^(\\d{1,15})(?:\\.(\\d{1,${Math.max(digits, 1)}}))?$`);
  const match = pattern.exec(input.trim());
  if (!match) return null;
  const fraction = match[2] ?? '';
  if (fraction.length > digits) return null;
  // Amounts are stored as major x 100 for every currency
  const cents = Number(match[1]) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Cents to an editable major-unit string without trailing zeros. */
export function centsToMajorString(cents: number): string {
  return String(Math.round(cents) / 100);
}
