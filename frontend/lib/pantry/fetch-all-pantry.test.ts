import { describe, expect, it, vi } from 'vitest';
import {
  fetchAllPantryItems,
  PANTRY_MAX_PAGES,
  PANTRY_PAGE_LIMIT,
} from './fetch-all-pantry';

const range = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => start + i);

describe('fetchAllPantryItems', () => {
  it('fetches a single page once with limit 100', async () => {
    const fetchPage = vi.fn(async () => ({ items: range(0, 10), pagination: { totalPages: 1 } }));
    const result = await fetchAllPantryItems(fetchPage);
    expect(result).toEqual(range(0, 10));
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(1, PANTRY_PAGE_LIMIT);
    expect(PANTRY_PAGE_LIMIT).toBe(100);
  });

  it('concatenates multiple pages in order', async () => {
    const pages = [range(0, 100), range(100, 100), range(200, 37)];
    const fetchPage = vi.fn(async (page: number, _limit: number) => ({
      items: pages[page - 1],
      pagination: { totalPages: 3 },
    }));
    const result = await fetchAllPantryItems(fetchPage);
    expect(result).toHaveLength(237);
    expect(result).toEqual(range(0, 237));
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    expect(fetchPage.mock.calls.every((c) => c[1] === 100)).toBe(true);
  });

  it('returns an empty list after one call when there are no items', async () => {
    const fetchPage = vi.fn(async () => ({ items: [], pagination: { totalPages: 0 } }));
    expect(await fetchAllPantryItems(fetchPage)).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('stops at the hard page cap when the server reports a huge totalPages', async () => {
    const fetchPage = vi.fn(async (page: number) => ({
      items: range(page * 1000, PANTRY_PAGE_LIMIT),
      pagination: { totalPages: 999 },
    }));
    const result = await fetchAllPantryItems(fetchPage);
    expect(PANTRY_MAX_PAGES).toBe(50);
    expect(fetchPage).toHaveBeenCalledTimes(PANTRY_MAX_PAGES);
    expect(result).toHaveLength(PANTRY_MAX_PAGES * PANTRY_PAGE_LIMIT);
  });

  it('ends early on a short page even if totalPages says more', async () => {
    const fetchPage = vi.fn(async () => ({ items: range(0, 40), pagination: { totalPages: 5 } }));
    const result = await fetchAllPantryItems(fetchPage);
    expect(result).toHaveLength(40);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('rejects the whole call when a later page fails', async () => {
    const fetchPage = vi.fn(async (page: number) => {
      if (page === 2) throw new Error('boom');
      return { items: range(0, PANTRY_PAGE_LIMIT), pagination: { totalPages: 3 } };
    });
    await expect(fetchAllPantryItems(fetchPage)).rejects.toThrow('boom');
  });

  it('lets callers bind filters inside the page function', async () => {
    const getAll = vi.fn(async (params: { page: number; limit: number; category?: string }) => ({
      items: [params.page],
      pagination: { totalPages: 1 },
    }));
    await fetchAllPantryItems((page, limit) => getAll({ page, limit, category: 'dairy' }));
    expect(getAll).toHaveBeenCalledWith({ page: 1, limit: 100, category: 'dairy' });
  });
});
