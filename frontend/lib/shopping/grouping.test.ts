import { describe, expect, it } from 'vitest';
import { groupItems, type GroupableItem } from './grouping';

const item = (over: Partial<GroupableItem> & { id: string }): GroupableItem => ({
  itemName: over.id,
  category: 'other',
  isChecked: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('groupItems', () => {
  it('orders groups by category order, other last, omitting empty', () => {
    const groups = groupItems([
      item({ id: 'a', category: 'other' }),
      item({ id: 'b', category: 'dairy' }),
      item({ id: 'c', category: 'protein' }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(['protein', 'dairy', 'other']);
  });

  it('maps unknown, blank and null categories into other', () => {
    const groups = groupItems([
      item({ id: 'a', category: 'produce' }),
      item({ id: 'b', category: '' }),
      item({ id: 'c', category: null }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('other');
    expect(groups[0].items).toHaveLength(3);
  });

  it('sinks checked items and counts unchecked', () => {
    const [g] = groupItems([
      item({ id: 'a', category: 'dairy', isChecked: true }),
      item({ id: 'b', category: 'dairy' }),
      item({ id: 'c', category: 'dairy' }),
    ]);
    expect(g.items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(g.uncheckedCount).toBe(2);
    expect(g.label).toBe('Dairy');
  });

  it('is stable by createdAt then itemName', () => {
    const [g] = groupItems([
      item({ id: '1', itemName: 'zeta', createdAt: '2026-01-02T00:00:00.000Z' }),
      item({ id: '2', itemName: 'beta', createdAt: '2026-01-01T00:00:00.000Z' }),
      item({ id: '3', itemName: 'alpha', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(g.items.map((i) => i.id)).toEqual(['3', '2', '1']);
  });

  it('does not mutate frozen input', () => {
    const input = Object.freeze([
      Object.freeze(item({ id: 'a', category: 'dairy', isChecked: true })),
      Object.freeze(item({ id: 'b', category: 'dairy' })),
    ]);
    expect(() => groupItems(input)).not.toThrow();
    expect(input.map((i) => i.id)).toEqual(['a', 'b']);
  });
});
