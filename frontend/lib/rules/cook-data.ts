/**
 * Boundary helpers between app data (API / React Query cache) and the pure
 * rules engine. No network imports: the page fetcher is injected.
 */

import type { RulesPantryItem, RulesRecipe, RulesRecipeIngredient } from './types';

/** Server max page size for both pantry and recipes endpoints. */
export const PAGE_SIZE = 100;
export const RECIPE_CAP = 500;
export const PANTRY_CAP = 2000;
const MAX_NAME_LENGTH = 200;
const DEFAULT_UNIT = 'pieces';

export type CookStatus =
  | 'loading'
  | 'noOfflineData'
  | 'error'
  | 'emptyPantry'
  | 'noRecipes'
  | 'filteredOut'
  | 'ready';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toQuantity(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function toName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().slice(0, MAX_NAME_LENGTH);
  return name === '' ? null : name;
}

function toUnit(value: unknown): string {
  return typeof value === 'string' && value !== '' ? value : DEFAULT_UNIT;
}

export function normalizePantry(raw: unknown): RulesPantryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row): RulesPantryItem[] => {
    if (!isRecord(row)) return [];
    const name = toName(row.ingredientName);
    if (typeof row.id !== 'string' || row.id === '' || name === null) return [];
    return [
      {
        id: row.id,
        ingredientName: name,
        quantity: toQuantity(row.quantity),
        unit: toUnit(row.unit),
        expiryDate: typeof row.expiryDate === 'string' && row.expiryDate ? row.expiryDate : null,
      },
    ];
  });
}

function normalizeIngredients(raw: unknown): RulesRecipeIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row): RulesRecipeIngredient[] => {
    if (!isRecord(row)) return [];
    const name = toName(row.ingredientName);
    if (name === null) return [];
    return [{ ingredientName: name, quantity: toQuantity(row.quantity), unit: toUnit(row.unit) }];
  });
}

export function normalizeRecipes(raw: unknown): RulesRecipe[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row): RulesRecipe[] => {
    if (!isRecord(row)) return [];
    const name = toName(row.name);
    if (typeof row.id !== 'string' || row.id === '' || name === null) return [];
    const ingredients = Object.freeze(
      normalizeIngredients(row.ingredients).map((i) => Object.freeze(i))
    );
    return [
      Object.freeze({
        id: row.id,
        name,
        totalTimeMinutes: toCount(row.totalTimeMinutes),
        servings: toCount(row.servings),
        ingredients,
      }),
    ];
  });
}

export interface PageResponse<T> {
  readonly items: T[];
  readonly pagination: { readonly totalPages: number };
}

export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<PageResponse<T>>,
  opts: { limit: number; cap: number }
): Promise<{ items: T[]; capped: boolean }> {
  let collected: T[] = [];
  let page = 1;
  for (;;) {
    const res = await fetchPage(page, opts.limit);
    const pageItems = Array.isArray(res.items) ? res.items : [];
    collected = [...collected, ...pageItems];
    const totalPages = res.pagination?.totalPages ?? 0;
    if (collected.length >= opts.cap) {
      return {
        items: collected.slice(0, opts.cap),
        capped: collected.length > opts.cap || page < totalPages,
      };
    }
    if (page >= totalPages) return { items: collected, capped: false };
    page += 1;
  }
}

export interface CookStatusInput {
  readonly hasData: boolean;
  readonly fetchStatus: 'fetching' | 'paused' | 'idle';
  readonly isError: boolean;
  readonly pantryCount: number;
  readonly recipeCount: number;
  readonly itemCount: number;
  readonly filtersActive: boolean;
  readonly engineFailed: boolean;
}

export function deriveCookStatus(input: CookStatusInput): CookStatus {
  if (!input.hasData) {
    if (input.fetchStatus === 'paused') return 'noOfflineData';
    if (input.isError) return 'error';
    return 'loading';
  }
  if (input.engineFailed) return 'error';
  if (input.pantryCount === 0) return 'emptyPantry';
  if (input.recipeCount === 0) return 'noRecipes';
  if (input.itemCount === 0 && input.filtersActive) return 'filteredOut';
  return 'ready';
}

export type PrefsState = 'loading' | 'ready' | 'unavailable';

/**
 * Dietary preferences gate the allergen filter. Without them the filter cannot run,
 * so callers must wait while they load and warn when they cannot be loaded.
 */
export function derivePrefsState(input: {
  readonly hasPrefs: boolean;
  readonly fetchStatus: 'fetching' | 'paused' | 'idle';
}): PrefsState {
  if (input.hasPrefs) return 'ready';
  return input.fetchStatus === 'fetching' ? 'loading' : 'unavailable';
}

/** Index raw rows by id, skipping corrupted entries (null, non-object, missing id). */
export function indexById<T extends { readonly id: string }>(
  raw: readonly unknown[] | undefined
): ReadonlyMap<string, T> {
  const entries: Array<readonly [string, T]> = [];
  for (const row of raw ?? []) {
    if (!isRecord(row) || typeof row.id !== 'string') continue;
    entries.push([row.id, row as unknown as T] as const);
  }
  return new Map(entries);
}
