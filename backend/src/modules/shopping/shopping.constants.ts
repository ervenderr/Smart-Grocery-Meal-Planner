/**
 * Shopping module limits, defaults and error codes.
 */

export const DEFAULT_LIST_NAME = 'Shopping list';
export const MAX_ITEMS_PER_LIST = 300;
export const MAX_ITEM_NAME_LENGTH = 100;
export const MAX_NOTES_LENGTH = 500;
export const MIN_QUANTITY = 0.01;
export const MAX_QUANTITY = 99999;
export const DEFAULT_QUANTITY = 1;
export const DEFAULT_UNIT = 'pieces';
export const DEFAULT_CATEGORY = 'other';
export const MAX_ITEM_CENTS = 200_000_000;
export const MAX_HISTORY_TOTAL_CENTS = 2_000_000_000;
export const HISTORY_PAGE_LIMIT_DEFAULT = 20;
export const HISTORY_PAGE_LIMIT_MAX = 50;
export const SHOPPING_RATE_LIMIT_MAX = 600;
export const SHOPPING_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_UNIT_LENGTH = 20;

/** Free-text units: letters, digits, space, '.', '%', '/', '-'. */
export const UNIT_TEXT_PATTERN = /^[\p{L}\p{N} .%/-]+$/u;

export const SHOPPING_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SHOPPING_LIST_FULL: 'SHOPPING_LIST_FULL',
  SHOPPING_ITEM_NOT_FOUND: 'SHOPPING_ITEM_NOT_FOUND',
  SHOPPING_LIST_EMPTY: 'SHOPPING_LIST_EMPTY',
  SHOPPING_LIST_NOTHING_CHECKED: 'SHOPPING_LIST_NOTHING_CHECKED',
  MEAL_PLAN_NOT_FOUND: 'MEAL_PLAN_NOT_FOUND',
  MEAL_PLAN_EMPTY: 'MEAL_PLAN_EMPTY',
  SHOPPING_RATE_LIMITED: 'SHOPPING_RATE_LIMITED',
} as const;

export type ShoppingErrorCode =
  (typeof SHOPPING_ERROR_CODES)[keyof typeof SHOPPING_ERROR_CODES];
