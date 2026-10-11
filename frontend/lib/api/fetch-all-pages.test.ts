import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './fetch-all-pages';

const page = (items: number[], totalPages: number) => ({ items, pagination: { totalPages } });

describe('fetchAllPages', () => {
  it('concatenates pages in order and stops at totalPages', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([1, 2], 3))
      .mockResolvedValueOnce(page([3, 4], 3))
      .mockResolvedValueOnce(page([5], 3));
    expect(await fetchAllPages(fetchPage, { limit: 2 })).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenLastCalledWith(3, 2);
  });

  it('stops after a single page', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([1], 1));
    expect(await fetchAllPages(fetchPage)).toEqual([1]);
    expect(fetchPage).toHaveBeenCalledWith(1, 100);
  });

  it('handles missing items', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ pagination: { totalPages: 1 } });
    expect(await fetchAllPages(fetchPage)).toEqual([]);
  });

  it('throws when maxPages is exceeded', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([1, 2], 99));
    await expect(fetchAllPages(fetchPage, { limit: 2, maxPages: 3 })).rejects.toThrow(/exceeded/);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
});
