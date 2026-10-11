/**
 * Shape helpers for the cook-from-pantry cache keys (COOK_PANTRY_KEY / COOK_RECIPES_KEY).
 * Those queries store `{ items, capped }` (from `fetchAllPages`), not a plain list, so any
 * offline writer (bootstrap seed, reapply, optimistic writes) must go through these helpers.
 * A plain array is accepted as a legacy persisted shape and healed into a page on write.
 */
export interface CookPage<T> {
  readonly items: T[];
  readonly capped: boolean;
}

export const isCookPage = (v: unknown): v is CookPage<unknown> =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Array.isArray((v as CookPage<unknown>).items) &&
  typeof (v as CookPage<unknown>).capped === 'boolean';

/** Wraps a full list in the cook page shape, applying the same cap as `fetchAllPages`. */
export const toCookPage = <T>(items: readonly T[], cap: number): CookPage<T> => ({
  items: items.slice(0, cap),
  capped: items.length > cap,
});

/** Items from a cook page or a legacy persisted array; undefined for anything else. */
export function cookPageItems<T>(data: unknown): T[] | undefined {
  if (isCookPage(data)) return data.items as T[];
  if (Array.isArray(data)) return data as T[];
  return undefined;
}

/** Applies `fn` to the page items immutably. Unknown shapes pass through unchanged. */
export function mapCookPage<T>(old: unknown, fn: (items: readonly T[]) => T[]): unknown {
  if (isCookPage(old)) return { ...old, items: fn(old.items as T[]) };
  if (Array.isArray(old)) return { items: fn(old as T[]), capped: false };
  return old;
}
