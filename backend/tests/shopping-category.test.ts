import { inferCategory } from '../src/modules/shopping/shopping.category';
import { PantryCategory } from '../src/types/pantry.types';

describe('inferCategory', () => {
  it.each([
    ['Chicken breast', 'protein'],
    ['eggs', 'protein'],
    ['eggplant', 'vegetable'],
    ['whole milk', 'dairy'],
    ['Greek yogurt', 'dairy'],
    ['Frozen peas', 'frozen'],
    ['canned tomatoes', 'canned'],
    ['black pepper', 'spices'],
    ['bell pepper', 'vegetable'],
    ['salt: coarse', 'spices'],
    ['soy sauce', 'condiments'],
    ['olive oil', 'condiments'],
    ['orange juice', 'beverages'],
    ['banana', 'fruit'],
    ['Basmati rice', 'grains'],
    ['xyzzy', 'other'],
    ['', 'other'],
    ['   ', 'other'],
  ])('%j -> %s', (name, expected) => {
    expect(inferCategory(name)).toBe(expected);
  });

  it('always returns a PantryCategory value', () => {
    const valid = Object.values(PantryCategory) as string[];
    for (const n of ['milk', 'zzz', 'Apple pie', '123']) {
      expect(valid).toContain(inferCategory(n));
    }
  });
});
