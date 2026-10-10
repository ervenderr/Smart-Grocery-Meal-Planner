import { describe, it, expect, vi, afterEach } from 'vitest';
import table from './data/substitutions.json';
import {
  findSubstitutes,
  hasSubstitute,
  matchSubstitutionKey,
  RESTRICTION_TAG_MAP,
} from './substitutions';

const none = { pantryHas: () => false, restrictions: [] as string[] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('matchSubstitutionKey', () => {
  it('matches exact canonical keys', () => {
    expect(matchSubstitutionKey('Buttermilk')).toBe('buttermilk');
    expect(matchSubstitutionKey('unsalted butter')).toBe('unsalted butter');
  });

  it('resolves aliases to their entry key', () => {
    expect(matchSubstitutionKey('cultured buttermilk')).toBe('buttermilk');
    expect(matchSubstitutionKey('Sugar')).toBe('white sugar');
  });

  it('falls back to whole-token subset, longest key first', () => {
    expect(matchSubstitutionKey('salted butter')).toBe('butter');
    expect(matchSubstitutionKey('organic brown sugar cubes')).toBe('brown sugar');
  });

  it('never matches substrings, unknown or empty names', () => {
    expect(matchSubstitutionKey('boiled eggs')).toBe('egg');
    expect(matchSubstitutionKey('subutter')).toBeNull();
    expect(matchSubstitutionKey('xyzzy')).toBeNull();
    expect(matchSubstitutionKey('')).toBeNull();
  });
});

describe('hasSubstitute', () => {
  it('is true for every table key and alias', () => {
    for (const entry of table.entries) {
      expect(hasSubstitute(entry.ingredient)).toBe(true);
      for (const alias of entry.aliases) expect(hasSubstitute(alias)).toBe(true);
    }
  });

  it('is false for unknown names and empty input', () => {
    expect(hasSubstitute('xyzzy')).toBe(false);
    expect(hasSubstitute('')).toBe(false);
  });

  it('uses token-subset fallback', () => {
    expect(hasSubstitute('salted butter')).toBe(true);
  });
});

describe('findSubstitutes scaling', () => {
  it('scales and formats the honey swap for sugar', () => {
    const result = findSubstitutes({ ingredientName: 'sugar', quantity: 1, unit: 'cups' }, none);
    const honey = result?.swaps.find((s) => s.name === 'honey');
    expect(honey?.ratioLine).toBe('Use 3/4 cup honey for 1 cup sugar');
  });

  it('expresses the amount in the recipe unit', () => {
    const result = findSubstitutes({ ingredientName: 'sugar', quantity: 2, unit: 'tbsp' }, none);
    const honey = result?.swaps.find((s) => s.name === 'honey');
    expect(honey?.ratioLine).toBe('Use 1 1/2 tbsp honey for 2 tbsp sugar');
  });

  it('doubles amounts for count-based ratios', () => {
    const result = findSubstitutes({ ingredientName: 'egg', quantity: 2, unit: 'pieces' }, none);
    const apple = result?.swaps.find((s) => s.name === 'applesauce');
    expect(apple?.ratioLine).toBe('Use 1/2 cup applesauce for 2 egg');
  });

  it('falls back to the unscaled line on family mismatch', () => {
    const result = findSubstitutes({ ingredientName: 'egg', quantity: 100, unit: 'grams' }, none);
    const apple = result?.swaps.find((s) => s.name === 'applesauce');
    expect(apple?.ratioLine).toBe('Use 1/4 cup per 1 of egg');
  });

  it.each([0, -1, Number.NaN, Infinity])('uses the unscaled line for quantity %s', (quantity) => {
    const result = findSubstitutes({ ingredientName: 'sugar', quantity, unit: 'cups' }, none);
    const honey = result?.swaps.find((s) => s.name === 'honey');
    expect(honey?.ratioLine).toBe('Use 3/4 cup per 1 cup of sugar');
  });
});

describe('findSubstitutes filtering', () => {
  it('removes swaps lacking the vegan tag and counts them', () => {
    const result = findSubstitutes(
      { ingredientName: 'sugar', quantity: 1, unit: 'cups' },
      { ...none, restrictions: ['vegan'] },
    );
    expect(result?.swaps.map((s) => s.name)).not.toContain('honey');
    expect(result?.hiddenCount).toBe(1);
    expect(result?.swaps).toHaveLength(3);
  });

  it('filters free-text restrictions by keyword', () => {
    const result = findSubstitutes(
      { ingredientName: 'almond butter', quantity: 1, unit: 'cups' },
      { ...none, restrictions: ['no peanuts'] },
    );
    expect(result?.swaps.map((s) => s.name)).toEqual(['sunflower seed butter']);
    expect(result?.hiddenCount).toBe(1);
  });

  it('returns no swaps when all are removed', () => {
    const entry = table.entries.find((e) => e.ingredient === 'almond butter');
    const result = findSubstitutes(
      { ingredientName: 'almond butter', quantity: 1, unit: 'cups' },
      { ...none, restrictions: ['peanut free', 'sunflower'] },
    );
    expect(result?.swaps).toEqual([]);
    expect(result?.hiddenCount).toBe(entry?.swaps.length);
  });

  it('maps restriction spellings to tags', () => {
    expect(RESTRICTION_TAG_MAP['gluten free']).toBe('gluten_free');
    expect(RESTRICTION_TAG_MAP.celiac).toBe('gluten_free');
    expect(RESTRICTION_TAG_MAP['lactose free']).toBe('dairy_free');
    expect(RESTRICTION_TAG_MAP['peanut allergy']).toBe('nut_free');
    expect(RESTRICTION_TAG_MAP.halal).toBe('halal');
    const result = findSubstitutes(
      { ingredientName: 'butter', quantity: 1, unit: 'cups' },
      { ...none, restrictions: ['Gluten-Free', 'dairy_free'] },
    );
    expect(result?.swaps.map((s) => s.name)).toEqual([
      'vegetable oil',
      'coconut oil',
      'olive oil',
    ]);
  });
});

describe('findSubstitutes ordering and purity', () => {
  it('lists in-pantry swaps first', () => {
    const result = findSubstitutes(
      { ingredientName: 'sugar', quantity: 1, unit: 'cups' },
      { pantryHas: (c) => c === 'honey', restrictions: [] },
    );
    expect(result?.swaps[0].name).toBe('honey');
    expect(result?.swaps[0].inPantry).toBe(true);
    expect(result?.swaps.slice(1).every((s) => !s.inPantry)).toBe(true);
    expect(result?.swaps.slice(1).map((s) => s.rank)).toEqual([1, 3, 4]);
  });

  it('requires every pantry name for inPantry', () => {
    const result = findSubstitutes(
      { ingredientName: 'buttermilk', quantity: 1, unit: 'cups' },
      { pantryHas: (c) => c === 'milk', restrictions: [] },
    );
    expect(result?.swaps.every((s) => !s.inPantry)).toBe(true);
  });

  it('returns null for unknown ingredients', () => {
    expect(findSubstitutes({ ingredientName: 'xyzzy', quantity: 1, unit: 'cups' }, none)).toBeNull();
  });

  it('makes no network call, is deterministic and does not mutate the table', () => {
    const fetchStub = vi.fn(() => {
      throw new Error('network');
    });
    vi.stubGlobal('fetch', fetchStub);
    const before = JSON.stringify(table);
    const query = { ingredientName: 'sugar', quantity: 1, unit: 'cups' };
    const a = findSubstitutes(query, none);
    const b = findSubstitutes(query, none);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
    expect(JSON.stringify(table)).toBe(before);
  });
});
