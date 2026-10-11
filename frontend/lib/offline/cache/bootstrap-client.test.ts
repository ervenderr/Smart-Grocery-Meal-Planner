import { describe, expect, it, vi } from 'vitest';
import { BootstrapError, fetchBootstrapSnapshot } from './bootstrap-client';

const page = (over: Record<string, unknown>) => ({
  serverTime: '2026-01-01T00:00:00Z',
  section: 'pantry',
  items: [],
  nextCursor: null,
  ...over,
});

describe('fetchBootstrapSnapshot', () => {
  it('assembles three pages into a snapshot, shopping list from page 1 only', async () => {
    const pages = [
      page({ items: [{ id: 'p1' }], nextCursor: 'c1', shoppingList: { id: 'first', items: [] } }),
      page({ section: 'recipes', items: [{ id: 'r1' }], nextCursor: 'c2', shoppingList: { id: 'later', items: [] } }),
      page({ section: 'mealPlans', items: [{ id: 'm1' }] }),
    ];
    const fetchPage = vi.fn(async () => pages[fetchPage.mock.calls.length - 1]);
    const snap = await fetchBootstrapSnapshot(fetchPage);
    expect(snap.pantry).toEqual([{ id: 'p1' }]);
    expect(snap.recipes).toEqual([{ id: 'r1' }]);
    expect(snap.mealPlans).toEqual([{ id: 'm1' }]);
    expect((snap.shoppingList as { id: string }).id).toBe('first');
    expect(fetchPage.mock.calls.map((c) => (c as unknown[])[0])).toEqual([null, 'c1', 'c2']);
  });

  it('returns null shopping list when page 1 has none', async () => {
    const snap = await fetchBootstrapSnapshot(async () => page({}));
    expect(snap.shoppingList).toBeNull();
  });

  it('throws BootstrapError on invalid page', async () => {
    await expect(fetchBootstrapSnapshot(async () => page({ items: 'nope' }))).rejects.toBeInstanceOf(BootstrapError);
  });

  it('throws on items without string id', async () => {
    await expect(fetchBootstrapSnapshot(async () => page({ items: [{ id: 5 }] }))).rejects.toBeInstanceOf(BootstrapError);
  });

  it('throws when maxPages exceeded', async () => {
    await expect(
      fetchBootstrapSnapshot(async () => page({ nextCursor: 'more' }), { maxPages: 3 }),
    ).rejects.toBeInstanceOf(BootstrapError);
  });

  it('propagates fetch rejection', async () => {
    await expect(
      fetchBootstrapSnapshot(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
  });
});
