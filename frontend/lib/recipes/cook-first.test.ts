import { describe, it, expect } from 'vitest';
import {
  normalizeCookFirst,
  localDateString,
  expiringBadge,
  filterCookFirstEntries,
  COOK_FIRST_QUERY_KEY,
  type CookFirstEntry,
} from './cook-first';
import type { Recipe } from '@/types/recipe.types';

function recipe(over: Partial<Recipe> & { id: string; name: string }): Recipe {
  return { category: 'dinner', difficulty: 'easy', ...over } as unknown as Recipe;
}

function entry(
  name: string,
  usesExpiring: { name: string; daysLeft: number }[],
  over: Partial<Recipe> = {}
): CookFirstEntry {
  return {
    recipe: recipe({ id: name, name, ...over }),
    score: 1,
    usesExpiring,
    coveragePercent: 50,
  };
}

describe('localDateString', () => {
  it('uses local getters', () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('normalizeCookFirst', () => {
  it('guards non-object payloads', () => {
    const empty = { items: [], expiringCount: 0, recipesCapped: false };
    expect(normalizeCookFirst(null)).toEqual(empty);
    expect(normalizeCookFirst('x')).toEqual(empty);
    expect(normalizeCookFirst({})).toEqual(empty);
  });

  it('reads the optional recipesCapped flag strictly', () => {
    expect(normalizeCookFirst({ items: [], recipesCapped: true }).recipesCapped).toBe(true);
    expect(normalizeCookFirst({ items: [], recipesCapped: 'yes' }).recipesCapped).toBe(false);
    expect(normalizeCookFirst({ items: [] }).recipesCapped).toBe(false);
  });

  it('drops malformed entries and clamps values', () => {
    const result = normalizeCookFirst({
      expiringCount: 2,
      items: [
        { recipe: { name: 'No id' }, score: 1, usesExpiring: [], coveragePercent: 10 },
        {
          recipe: { id: 'a', name: 'A' },
          score: 5,
          usesExpiring: [
            { name: 'spinach', daysLeft: 1 },
            { name: 'bad', daysLeft: -1 },
            { name: 'nan', daysLeft: Number.NaN },
            { name: 3, daysLeft: 1 },
          ],
          coveragePercent: 140,
        },
        { recipe: { id: 'b', name: 'B' }, score: 0, usesExpiring: [], coveragePercent: -5 },
      ],
    });
    expect(result.expiringCount).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].usesExpiring).toEqual([{ name: 'spinach', daysLeft: 1 }]);
    expect(result.items[0].coveragePercent).toBe(100);
    expect(result.items[1].coveragePercent).toBe(0);
  });
});

describe('expiringBadge', () => {
  it('returns null when nothing expiring', () => {
    expect(expiringBadge(entry('A', []))).toBeNull();
  });
  it('formats single items', () => {
    expect(expiringBadge(entry('A', [{ name: 'spinach', daysLeft: 0 }]))).toBe(
      'Uses spinach (expires today)'
    );
    expect(expiringBadge(entry('A', [{ name: 'spinach', daysLeft: 1 }]))).toBe(
      'Uses spinach (1 day left)'
    );
  });
  it('summarises many items using the soonest first', () => {
    const e = entry('A', [
      { name: 'milk', daysLeft: 3 },
      { name: 'spinach', daysLeft: 0 },
      { name: 'eggs', daysLeft: 2 },
    ]);
    expect(expiringBadge(e)).toBe('Uses spinach + 2 more expiring');
  });
});

describe('filterCookFirstEntries', () => {
  const entries = [
    entry('Tomato soup', [], { category: 'lunch', difficulty: 'easy' }),
    entry('Pasta', [], { category: 'dinner', difficulty: 'hard' }),
    entry('Onion soup', [], { category: 'dinner', difficulty: 'easy' }),
  ];
  it('searches case-insensitively and preserves order', () => {
    expect(filterCookFirstEntries(entries, { search: 'SOUP' }).map((e) => e.recipe.name)).toEqual([
      'Tomato soup',
      'Onion soup',
    ]);
  });
  it('filters by category and difficulty without mutating', () => {
    const copy = [...entries];
    const out = filterCookFirstEntries(entries, { category: 'dinner', difficulty: 'easy' });
    expect(out.map((e) => e.recipe.name)).toEqual(['Onion soup']);
    expect(entries).toEqual(copy);
  });
});

describe('COOK_FIRST_QUERY_KEY', () => {
  it('lives under recipes', () => {
    const key = COOK_FIRST_QUERY_KEY('2026-01-05', 3, false);
    expect(key.slice(0, 2)).toEqual(['recipes', 'cook-first']);
  });
});
