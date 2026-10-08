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

/** Parse a major-unit string ("12.34") to integer cents; null when invalid. */
export function parseMajorToCents(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Cents to an editable major-unit string without trailing zeros. */
export function centsToMajorString(cents: number): string {
  return String(Math.round(cents) / 100);
}
