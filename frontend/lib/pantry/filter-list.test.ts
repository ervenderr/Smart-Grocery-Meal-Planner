import { describe, expect, it } from 'vitest';
import { filterPantryItems } from './filter-list';
import type { PantryItem } from '@/types/pantry.types';

const make = (id: string, ingredientName: string, category: string, extra = {}) =>
  ({ id, ingredientName, category, quantity: 1, ...extra }) as unknown as PantryItem;

const items = [
  make('1', 'Milk', 'dairy'),
  make('2', 'Rice', 'grains', { brand: 'Golden Milkway' }),
  make('3', 'Cheese', 'dairy'),
];

describe('filterPantryItems', () => {
  it('returns all items for empty filters as a new array', () => {
    const result = filterPantryItems(items, {});
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it('matches search case-insensitively on name and brand', () => {
    expect(filterPantryItems(items, { search: 'mil' }).map((i) => i.id)).toEqual(['1', '2']);
  });

  it('filters category exactly', () => {
    expect(filterPantryItems(items, { category: 'dairy' }).map((i) => i.id)).toEqual(['1', '3']);
  });

  it('combines category and search', () => {
    expect(filterPantryItems(items, { category: 'dairy', search: 'CHE' }).map((i) => i.id)).toEqual(['3']);
  });

  it('does not mutate input', () => {
    const copy = [...items];
    filterPantryItems(items, { search: 'x' });
    expect(items).toEqual(copy);
  });
});
