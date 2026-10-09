import { rankCookFirst, URGENCY_WEIGHTS } from '../src/modules/intelligence/cook-first';

const TODAY = new Date(Date.UTC(2026, 9, 10));
const inDays = (n: number) => new Date(Date.UTC(2026, 9, 10 + n));
const recipe = (id: string, title: string, names: string[], total = 30) => ({
  id,
  title,
  totalTimeMinutes: total,
  ingredientNames: names,
});
const rank = (
  recipes: ReturnType<typeof recipe>[],
  pantry: { ingredientName: string; expiryDate: Date | null }[],
  extra: Partial<{ staples: ReadonlySet<string>; today: Date; limit: number; includeAll: boolean }> = {},
) =>
  rankCookFirst({
    recipes,
    pantry,
    staples: new Set<string>(),
    today: TODAY,
    limit: 10,
    includeAll: false,
    ...extra,
  });

describe('rankCookFirst', () => {
  it('exposes urgency weights', () => {
    expect(URGENCY_WEIGHTS).toEqual({ soon: 5, near: 3, week: 1 });
  });

  it('ranks the recipe using an item expiring today first', () => {
    const out = rank(
      [recipe('a', 'A', ['milk']), recipe('b', 'B', ['spinach'])],
      [
        { ingredientName: 'Milk', expiryDate: inDays(5) },
        { ingredientName: 'Spinach', expiryDate: inDays(0) },
      ],
    );
    expect(out.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it.each([
    [0, 5],
    [1, 5],
    [2, 3],
    [3, 3],
    [4, 1],
    [7, 1],
    [8, 0],
  ])('daysLeft %i scores %i', (days, score) => {
    const out = rank([recipe('a', 'A', ['egg'])], [{ ingredientName: 'egg', expiryDate: inDays(days) }], {
      includeAll: true,
    });
    expect(out[0].score).toBe(score);
  });

  it('excludes expired lots; null expiry counts for coverage only', () => {
    const out = rank(
      [recipe('a', 'A', ['egg', 'rice'])],
      [
        { ingredientName: 'egg', expiryDate: inDays(-1) },
        { ingredientName: 'rice', expiryDate: null },
      ],
      { includeAll: true },
    );
    expect(out[0].score).toBe(0);
    expect(out[0].usesExpiring).toEqual([]);
    expect(out[0].coveragePercent).toBe(50);
  });

  it('uses the minimum daysLeft across lots of the same name', () => {
    const out = rank(
      [recipe('a', 'A', ['spinach'])],
      [
        { ingredientName: 'Spinach', expiryDate: inDays(6) },
        { ingredientName: 'spinach', expiryDate: inDays(1) },
      ],
    );
    expect(out[0].usesExpiring).toEqual([{ name: 'spinach', daysLeft: 1 }]);
    expect(out[0].score).toBe(5);
  });

  it('two expiring items beat one', () => {
    const out = rank(
      [recipe('one', 'One', ['spinach']), recipe('two', 'Two', ['spinach', 'kale'])],
      [
        { ingredientName: 'spinach', expiryDate: inDays(1) },
        { ingredientName: 'kale', expiryDate: inDays(6) },
      ],
    );
    expect(out.map((r) => r.id)).toEqual(['two', 'one']);
    expect(out[0].score).toBe(6);
  });

  describe('tie breaks', () => {
    const pantry = [
      { ingredientName: 'egg', expiryDate: inDays(1) },
      { ingredientName: 'rice', expiryDate: null },
    ];
    it('coverage desc', () => {
      const out = rank([recipe('a', 'A', ['egg', 'x']), recipe('b', 'B', ['egg', 'rice'])], pantry);
      expect(out.map((r) => r.id)).toEqual(['b', 'a']);
    });
    it('shorter total time', () => {
      const out = rank([recipe('a', 'A', ['egg'], 60), recipe('b', 'B', ['egg'], 10)], pantry);
      expect(out.map((r) => r.id)).toEqual(['b', 'a']);
    });
    it('title case-insensitive', () => {
      const out = rank([recipe('a', 'banana', ['egg']), recipe('b', 'Apple', ['egg'])], pantry);
      expect(out.map((r) => r.id)).toEqual(['b', 'a']);
    });
    it('id', () => {
      const out = rank([recipe('z', 'Same', ['egg']), recipe('y', 'same', ['egg'])], pantry);
      expect(out.map((r) => r.id)).toEqual(['y', 'z']);
    });
  });

  it('coverage counts staples and handles empty recipes', () => {
    const out = rank(
      [recipe('a', 'A', ['egg', 'salt']), recipe('e', 'E', [])],
      [{ ingredientName: 'egg', expiryDate: inDays(2) }],
      { staples: new Set(['salt']), includeAll: true },
    );
    expect(out[0].coveragePercent).toBe(100);
    expect(out[1]).toMatchObject({ id: 'e', coveragePercent: 0, score: 0 });
  });

  it('limit truncates when not includeAll; includeAll ignores limit and appends zero-score', () => {
    const recipes = [recipe('a', 'A', ['egg']), recipe('b', 'B', ['egg']), recipe('c', 'C', ['rice'])];
    const pantry = [{ ingredientName: 'egg', expiryDate: inDays(1) }];
    expect(rank(recipes, pantry, { limit: 1 }).map((r) => r.id)).toEqual(['a']);
    expect(rank(recipes, pantry, { limit: 1, includeAll: true }).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('matches plural pantry names and shifts with today', () => {
    const pantry = [{ ingredientName: 'Tomatoes', expiryDate: inDays(2) }];
    const base = rank([recipe('a', 'A', ['tomato'])], pantry);
    expect(base[0].usesExpiring[0]).toEqual({ name: 'tomato', daysLeft: 2 });
    const later = rank([recipe('a', 'A', ['tomato'])], pantry, { today: inDays(1) });
    expect(later[0].usesExpiring[0].daysLeft).toBe(1);
  });

  it('does not mutate frozen inputs', () => {
    const recipes = Object.freeze([Object.freeze(recipe('a', 'A', ['egg']))]);
    const pantry = Object.freeze([Object.freeze({ ingredientName: 'egg', expiryDate: inDays(1) })]);
    expect(() => rank(recipes as never, pantry as never)).not.toThrow();
  });
});
