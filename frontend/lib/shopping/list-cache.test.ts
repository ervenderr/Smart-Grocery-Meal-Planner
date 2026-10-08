import { describe, it, expect } from 'vitest';
import { applyItemPatch, removeItem, upsertItem, toCreateInput } from './list-cache';
import type { ShoppingItem, ShoppingList } from '@/types/shopping.types';

const makeItem = (id: string, overrides: Partial<ShoppingItem> = {}): ShoppingItem =>
  Object.freeze({
    id,
    shoppingListId: 'l1',
    itemName: `item-${id}`,
    quantity: 1,
    unit: 'pcs',
    category: 'produce',
    costEstimateCents: 100,
    actualCostCents: null,
    isChecked: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });

const makeList = (items: ShoppingItem[]): ShoppingList =>
  Object.freeze({
    id: 'l1',
    name: 'My list',
    mealPlanId: null,
    isCompleted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    items: Object.freeze(items) as ShoppingItem[],
  });

describe('applyItemPatch', () => {
  it('patches only the matching item and keeps others by reference', () => {
    const a = makeItem('a');
    const b = makeItem('b');
    const list = makeList([a, b]);
    const next = applyItemPatch(list, 'a', { isChecked: true });
    expect(next).not.toBe(list);
    expect(next?.items[0].isChecked).toBe(true);
    expect(next?.items[1]).toBe(b);
    expect(a.isChecked).toBe(false);
    expect(list.items[0]).toBe(a);
  });

  it('returns an equal list for an unknown id', () => {
    const list = makeList([makeItem('a')]);
    expect(applyItemPatch(list, 'zzz', { isChecked: true })).toEqual(list);
  });

  it('returns undefined for undefined list', () => {
    expect(applyItemPatch(undefined, 'a', {})).toBeUndefined();
  });
});

describe('removeItem', () => {
  it('returns the new list and the removed item', () => {
    const a = makeItem('a');
    const b = makeItem('b');
    const list = makeList([a, b]);
    const result = removeItem(list, 'a');
    expect(result.removed).toBe(a);
    expect(result.list?.items).toEqual([b]);
    expect(list.items).toHaveLength(2);
  });

  it('returns removed null for unknown id', () => {
    const list = makeList([makeItem('a')]);
    const result = removeItem(list, 'x');
    expect(result.removed).toBeNull();
    expect(result.list).toEqual(list);
  });

  it('handles undefined list', () => {
    expect(removeItem(undefined, 'a')).toEqual({ list: undefined, removed: null });
  });
});

describe('upsertItem', () => {
  it('appends a new item', () => {
    const list = makeList([makeItem('a')]);
    const next = upsertItem(list, makeItem('b'));
    expect(next?.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('replaces an item with the same id without duplicating', () => {
    const list = makeList([makeItem('a'), makeItem('b')]);
    const next = upsertItem(list, makeItem('a', { itemName: 'renamed' }));
    expect(next?.items).toHaveLength(2);
    expect(next?.items[0].itemName).toBe('renamed');
  });

  it('returns undefined for undefined list', () => {
    expect(upsertItem(undefined, makeItem('a'))).toBeUndefined();
  });
});

describe('toCreateInput', () => {
  it('copies the re-creatable fields only', () => {
    const input = toCreateInput(makeItem('a', { notes: 'n', isChecked: true }));
    expect(input).toEqual({
      itemName: 'item-a',
      quantity: 1,
      unit: 'pcs',
      category: 'produce',
      costEstimateCents: 100,
      actualCostCents: null,
      isChecked: true,
      notes: 'n',
    });
  });
});
