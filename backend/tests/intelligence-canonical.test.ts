import { canonicalName } from '../src/modules/intelligence/canonical';

const ROWS: ReadonlyArray<readonly [string, string]> = [
  ['  Tomatoes ', 'tomato'],
  ['Berries', 'berry'],
  ['Peaches', 'peach'],
  ['Potatoes', 'potato'],
  ['Radishes', 'radish'],
  ['Scallions', 'green onion'],
  ['Green Onions', 'green onion'],
  ['spring onion', 'green onion'],
  ['Aubergine', 'eggplant'],
  ['Garbanzo Beans', 'chickpea'],
  ["Confectioner's sugar", 'powdered sugar'],
  ['Plain flour', 'all purpose flour'],
  ['Hummus', 'hummus'],
  ['Asparagus', 'asparagus'],
  ['Couscous', 'couscous'],
  ['Molasses', 'molasses'],
  ['Rolled Oats', 'rolled oats'],
  ['Cloves', 'clove'],
  ['All-Purpose Flour', 'all purpose flour'],
  ['Salt: coarse', 'salt'],
  ['onion, finely diced', 'onion'],
  ['Garlic (minced)', 'garlic'],
  ['Chicken Breasts', 'chicken breast'],
  ['pepper', 'pepper'],
  ['Bell Peppers', 'bell pepper'],
  ['almond flour', 'almond flour'],
  ['  ', ''],
  ['!!!', ''],
  ['', ''],
];

describe('canonicalName', () => {
  it.each(ROWS)('%p -> %p', (input, expected) => {
    expect(canonicalName(input)).toBe(expected);
  });

  it('keeps distinct keys distinct', () => {
    expect(canonicalName('almond flour')).not.toBe(canonicalName('flour'));
    expect(canonicalName('Bell Peppers')).not.toBe(canonicalName('pepper'));
  });

  it.each([[123], [null], [undefined], [{}]])('non-string %p -> empty', (input) => {
    expect(canonicalName(input as unknown)).toBe('');
  });

  it('is idempotent for every row', () => {
    for (const [input] of ROWS) {
      const once = canonicalName(input);
      expect(canonicalName(once)).toBe(once);
    }
  });

  it('handles a 5000-char input in under 50 ms', () => {
    const start = Date.now();
    canonicalName('a '.repeat(2500));
    canonicalName('('.repeat(5000));
    expect(Date.now() - start).toBeLessThan(50);
  });
});
