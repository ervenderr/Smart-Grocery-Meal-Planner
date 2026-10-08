import { parseMajorToCents } from '@/lib/currency/format';
import { DEFAULT_QUANTITY, MAX_ITEM_CENTS, MAX_QUANTITY, MIN_QUANTITY } from './vocab';

export type PriceParseResult =
  | { readonly ok: true; readonly cents: number | null }
  | { readonly ok: false; readonly message: string };

export type QuantityParseResult =
  | { readonly ok: true; readonly quantity: number }
  | { readonly ok: false; readonly message: string };

const QUANTITY_PATTERN = /^\d{1,5}(\.\d{1,2})?$/;

/** Blank clears the price (null); otherwise strict major-unit parse bounded to the backend cap. */
export function parseItemPriceInput(input: string, currency?: string): PriceParseResult {
  if (input.trim() === '') return { ok: true, cents: null };
  const cents = parseMajorToCents(input, currency);
  if (cents === null) {
    return { ok: false, message: 'Enter a valid price using digits and a decimal point only.' };
  }
  if (cents > MAX_ITEM_CENTS) {
    return {
      ok: false,
      message: `Price can be at most ${(MAX_ITEM_CENTS / 100).toLocaleString('en-US')}.`,
    };
  }
  return { ok: true, cents };
}

/** Blank defaults to 1; otherwise up to 5 digits and 2 decimals within backend bounds. */
export function parseQuantityInput(input: string): QuantityParseResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, quantity: DEFAULT_QUANTITY };
  if (!QUANTITY_PATTERN.test(trimmed)) {
    return { ok: false, message: 'Enter a quantity using digits and up to 2 decimals.' };
  }
  const quantity = Number(trimmed);
  if (quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
    return { ok: false, message: `Quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}.` };
  }
  return { ok: true, quantity };
}
