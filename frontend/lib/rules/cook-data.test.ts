import { describe, expect, it, vi } from 'vitest';
import {
  PAGE_SIZE,
  deriveCookStatus,
  fetchAllPages,
  normalizePantry,
  normalizeRecipes,
} from './cook-data';

describe('normalizePantry', () => {
  it('drops bad rows and coerces fields', () => {
    const out = normalizePantry([
      { id: 'a', ingredientName: 'Milk', quantity: '2.50', unit: 'liters', expiryDate: '2026-10-12' },
      { id: 'b', ingredientName: 'Rice', quantity: 'abc', unit: 5, expiryDate: 7 },
      { id: 'c', ingredientName: 'Salt', quantity: -3, unit: 'grams', expiryDate: null },
      { ingredientName: 'NoId', quantity: 1 },
      { id: 'd' },
      null,
    ]);
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(out[0]).toMatchObject({ quantity: 2.5, unit: 'liters', expiryDate: '2026-10-12' });
    expect(out[1]).toMatchObject({ quantity: 0, unit: 'pieces', expiryDate: null });
    expect(out[2].quantity).toBe(0);
  });

  it('caps name length and handles non-arrays', () => {
    const out = normalizePantry([{ id: 'a', ingredientName: 'x'.repeat(500), quantity: 1 }]);
    expect(out[0].ingredientName).toHaveLength(200);
    expect(normalizePantry(undefined)).toEqual([]);
    expect(normalizePantry({})).toEqual([]);
  });
});

describe('normalizeRecipes', () => {
  it('drops bad rows, coerces ingredients and freezes', () => {
    const out = normalizeRecipes([
      {
        id: 'r1',
        name: 'Soup',
        totalTimeMinutes: 'x',
        servings: 4,
        ingredients: [
          { ingredientName: 'Carrot', quantity: '2', unit: 'pieces' },
          { quantity: 1, unit: 'g' },
          { ingredientName: 'Salt', quantity: 'zzz' },
        ],
      },
      { id: 'r2' },
      { name: 'x' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].totalTimeMinutes).toBe(0);
    expect(out[0].ingredients).toEqual([
      { ingredientName: 'Carrot', quantity: 2, unit: 'pieces' },
      { ingredientName: 'Salt', quantity: 0, unit: 'pieces' },
    ]);
    expect(Object.isFrozen(out[0])).toBe(true);
    expect(normalizeRecipes('nope')).toEqual([]);
  });
});

describe('fetchAllPages', () => {
  const pager = (totalPages: number, perPage: number) =>
    vi.fn(async (page: number) => ({
      items: Array.from({ length: perPage }, (_, i) => page * 1000 + i),
      pagination: { totalPages },
    }));

  it('fetches every page sequentially', async () => {
    const fn = pager(3, 2);
    const out = await fetchAllPages(fn, { limit: 2, cap: 100 });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(1, 1, 2);
    expect(out.items).toHaveLength(6);
    expect(out.capped).toBe(false);
  });

  it('stops at the cap', async () => {
    const fn = pager(10, 100);
    const out = await fetchAllPages(fn, { limit: 100, cap: 250 });
    expect(out.items).toHaveLength(250);
    expect(out.capped).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('makes one call when totalPages is 0', async () => {
    const fn = pager(0, 0);
    const out = await fetchAllPages(fn, { limit: 100, cap: 500 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ items: [], capped: false });
  });

  it('propagates page errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(fetchAllPages(fn, { limit: 100, cap: 500 })).rejects.toThrow('boom');
  });

  it('uses PAGE_SIZE 100', () => expect(PAGE_SIZE).toBe(100));
});

describe('deriveCookStatus', () => {
  const base = {
    hasData: true,
    fetchStatus: 'idle' as const,
    isError: false,
    pantryCount: 3,
    recipeCount: 3,
    itemCount: 2,
    filtersActive: false,
    engineFailed: false,
  };
  it('handles missing data', () => {
    expect(deriveCookStatus({ ...base, hasData: false, fetchStatus: 'paused' })).toBe('noOfflineData');
    expect(deriveCookStatus({ ...base, hasData: false, fetchStatus: 'fetching' })).toBe('loading');
    expect(deriveCookStatus({ ...base, hasData: false, isError: true })).toBe('error');
  });
  it('keeps ready with data despite refetch problems', () => {
    expect(deriveCookStatus({ ...base, isError: true })).toBe('ready');
    expect(deriveCookStatus({ ...base, fetchStatus: 'paused' })).toBe('ready');
  });
  it('derives empties', () => {
    expect(deriveCookStatus({ ...base, pantryCount: 0 })).toBe('emptyPantry');
    expect(deriveCookStatus({ ...base, recipeCount: 0 })).toBe('noRecipes');
    expect(deriveCookStatus({ ...base, itemCount: 0, filtersActive: true })).toBe('filteredOut');
    expect(deriveCookStatus({ ...base, engineFailed: true })).toBe('error');
  });
});
