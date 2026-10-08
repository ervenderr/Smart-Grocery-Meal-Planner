import { aggregateIngredients } from '../src/modules/mealplan/mealplan.aggregate';

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

  it('keeps different units separate', () => {
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
    expect(out).toHaveLength(2);
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
