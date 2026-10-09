import { aggregateGroups, aggregateIngredients } from '../src/modules/mealplan/mealplan.aggregate';

const item = (servings: number, recipe: { servings: number; title: string; ingredientsList: unknown }) => ({
  servings,
  recipe,
});

describe('aggregateIngredients', () => {
  it('keeps names containing a colon intact', () => {
    const out = aggregateIngredients([
      item(2, {
        servings: 2,
        title: 'R',
        ingredientsList: [{ ingredientName: 'Salt: coarse', quantity: 1, unit: 'tsp' }],
      }),
    ]);
    expect(out).toEqual([{ ingredientName: 'Salt: coarse', quantity: 1, unit: 'tsp', recipes: ['R'] }]);
  });

  it('merges same name/unit case-insensitively using first-seen text', () => {
    const out = aggregateIngredients([
      item(1, { servings: 1, title: 'A', ingredientsList: [{ ingredientName: 'Onion', quantity: 1, unit: 'pieces' }] }),
      item(1, { servings: 1, title: 'B', ingredientsList: [{ ingredientName: 'onion ', quantity: 2, unit: 'Pieces' }] }),
    ]);
    expect(out).toEqual([{ ingredientName: 'Onion', quantity: 3, unit: 'pieces', recipes: ['A', 'B'] }]);
  });

  // Phase 5: same-family units merge (INT-02)
  it('merges cups and liters of the same ingredient into one volume line', () => {
    const out = aggregateIngredients([
      item(1, {
        servings: 1,
        title: 'A',
        ingredientsList: [
          { ingredientName: 'Milk', quantity: 1, unit: 'cups' },
          { ingredientName: 'Milk', quantity: 1, unit: 'liters' },
        ],
      }),
    ]);
    expect(out).toEqual([{ ingredientName: 'Milk', quantity: 1.24, unit: 'liters', recipes: ['A'] }]);
  });

  it('keeps volume and count units of the same ingredient separate', () => {
    const out = aggregateIngredients([
      item(1, {
        servings: 1,
        title: 'A',
        ingredientsList: [
          { ingredientName: 'Milk', quantity: 1, unit: 'cups' },
          { ingredientName: 'Milk', quantity: 2, unit: 'pieces' },
        ],
      }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('merges grams and kg across recipes (1.5 kg)', () => {
    const out = aggregateIngredients([
      item(1, { servings: 1, title: 'A', ingredientsList: [{ ingredientName: 'Flour', quantity: 500, unit: 'grams' }] }),
      item(1, { servings: 1, title: 'B', ingredientsList: [{ ingredientName: 'flour', quantity: 1, unit: 'kg' }] }),
    ]);
    expect(out).toEqual([{ ingredientName: 'Flour', quantity: 1.5, unit: 'kg', recipes: ['A', 'B'] }]);
  });

  it('merges singular and plural names', () => {
    const out = aggregateIngredients([
      item(1, {
        servings: 1,
        title: 'A',
        ingredientsList: [
          { ingredientName: 'Tomatoes', quantity: 2, unit: 'pieces' },
          { ingredientName: 'tomato', quantity: 1, unit: 'pieces' },
        ],
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ quantity: 3, unit: 'pieces' });
  });

  it('applies the display ladder even to a single-unit group', () => {
    const out = aggregateIngredients([
      item(1, { servings: 1, title: 'A', ingredientsList: [{ ingredientName: 'rice', quantity: 2000, unit: 'grams' }] }),
    ]);
    expect(out[0]).toMatchObject({ quantity: 2, unit: 'kg' });
  });

  it('sums thirds exactly (three 1/3 cup lines are 1 cup, not 0.99)', () => {
    const list = [{ ingredientName: 'sugar', quantity: 1, unit: 'cups' }];
    const out = aggregateIngredients([
      item(1, { servings: 3, title: 'A', ingredientsList: list }),
      item(1, { servings: 3, title: 'B', ingredientsList: list }),
      item(1, { servings: 3, title: 'C', ingredientsList: list }),
    ]);
    expect(out[0]).toMatchObject({ quantity: 1, unit: 'cups' });
  });

  it('aggregateGroups counts zero-quantity entries but creates no group for them', () => {
    const res = aggregateGroups([
      item(1, {
        servings: 1,
        title: 'A',
        ingredientsList: [
          { ingredientName: 'Salt', quantity: 0, unit: 'tsp' },
          { ingredientName: 'Pepper', quantity: 1, unit: 'tsp' },
          { ingredientName: '', quantity: 1, unit: 'tsp' },
        ],
      }),
    ]);
    expect(res.ingredientCount).toBe(2);
    expect(res.groups).toHaveLength(1);
  });

  it('applies the servings multiplier, defaulting to 1 for bad recipe servings', () => {
    const list = [{ ingredientName: 'Rice', quantity: 1, unit: 'cups' }];
    expect(aggregateIngredients([item(4, { servings: 2, title: 'A', ingredientsList: list })])[0].quantity).toBe(2);
    expect(aggregateIngredients([item(4, { servings: 0, title: 'A', ingredientsList: list })])[0].quantity).toBe(1);
    expect(
      aggregateIngredients([item(4, { servings: undefined as unknown as number, title: 'A', ingredientsList: list })])[0].quantity,
    ).toBe(1);
  });

  it('skips malformed data without throwing', () => {
    const out = aggregateIngredients([
      item(1, { servings: 1, title: 'A', ingredientsList: 'nope' }),
      item(1, {
        servings: 1,
        title: 'B',
        ingredientsList: [
          { ingredientName: '  ', quantity: 1, unit: 'g' },
          { ingredientName: 'Bad', quantity: NaN, unit: 'g' },
          { ingredientName: 'Neg', quantity: -1, unit: 'g' },
          null,
          { ingredientName: 'Ok', quantity: 1, unit: 'g' },
        ],
      }),
    ]);
    expect(out.map((o) => o.ingredientName)).toEqual(['Ok']);
  });

  it('rounds to 2 decimals, lists unique recipe titles and does not mutate input', () => {
    const input = Object.freeze([
      item(1, { servings: 3, title: 'A', ingredientsList: Object.freeze([{ ingredientName: 'X', quantity: 1, unit: 'g' }]) }),
      item(1, { servings: 3, title: 'A', ingredientsList: [{ ingredientName: 'X', quantity: 1, unit: 'g' }] }),
    ]);
    const out = aggregateIngredients(input);
    expect(out[0].quantity).toBe(0.67);
    expect(out[0].recipes).toEqual(['A']);
  });
});
