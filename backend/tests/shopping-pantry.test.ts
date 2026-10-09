/**
 * Pure bought-it merge planner (phase 06-04).
 */

import { planPantryMerge, toPantryUnit } from '../src/modules/shopping/shopping-pantry';
import type {
  CheckedItem,
  PantryLotRow,
} from '../src/modules/shopping/shopping-pantry';

const TODAY = new Date('2026-10-09T00:00:00.000Z');
const PURCHASE = new Date('2026-10-08T00:00:00.000Z');

const item = (over: Partial<CheckedItem> = {}): CheckedItem => ({
  itemName: 'Milk',
  quantity: 1,
  unit: 'liters',
  category: null,
  actualCostCents: null,
  costEstimateCents: null,
  ...over,
});

const lot = (over: Partial<PantryLotRow> = {}): PantryLotRow => ({
  id: 'lot-1',
  ingredientName: 'milk',
  quantity: 500,
  unit: 'ml',
  expiryDate: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  ...over,
});

const plan = (checked: CheckedItem[], lots: PantryLotRow[] = []) =>
  planPantryMerge({
    checked: Object.freeze(checked.map((c) => Object.freeze(c))),
    lots: Object.freeze(lots.map((l) => Object.freeze(l))),
    purchaseDate: PURCHASE,
    todayUtc: TODAY,
  });

describe('toPantryUnit', () => {
  it.each([
    ['can', 'pieces', 'can'],
    ['bunch', 'pieces', 'bunch'],
    ['', 'pieces', null],
    [null, 'pieces', null],
    [undefined, 'pieces', null],
    ['Kg', 'kg', null],
    ['lb', 'lbs', null],
    ['g', 'grams', null],
    ['cup', 'cups', null],
    ['items', 'pieces', null],
  ])('maps %p to %p (coercedFrom %p)', (raw, unit, coercedFrom) => {
    expect(toPantryUnit(raw as string | null | undefined)).toEqual({ unit, coercedFrom });
  });
});

describe('planPantryMerge: merge', () => {
  it('merges into a same-family lot using the lot unit', () => {
    const p = plan([item()], [lot()]);
    expect(p.updates).toEqual([{ id: 'lot-1', quantity: 1500 }]);
    expect(p.creates).toHaveLength(0);
    expect(p).toMatchObject({ merged: 1, added: 0, skipped: 0 });
  });

  it('picks the soonest-expiring candidate, null expiry last', () => {
    const p = plan(
      [item()],
      [
        lot({ id: 'none', expiryDate: null }),
        lot({ id: 'late', expiryDate: new Date('2026-11-01T00:00:00.000Z') }),
        lot({ id: 'soon', expiryDate: new Date('2026-10-12T00:00:00.000Z') }),
      ],
    );
    expect(p.updates.map((u) => u.id)).toEqual(['soon']);
  });

  it('never merges into an expired lot', () => {
    const p = plan([item()], [lot({ expiryDate: new Date('2026-10-01T00:00:00.000Z') })]);
    expect(p.updates).toHaveLength(0);
    expect(p.creates).toHaveLength(1);
  });

  it('treats a lot expiring today as not expired', () => {
    const p = plan([item()], [lot({ expiryDate: TODAY })]);
    expect(p.updates).toHaveLength(1);
  });

  it('merges into a used-up (quantity 0) lot', () => {
    const p = plan([item()], [lot({ quantity: 0, unit: 'liters' })]);
    expect(p.updates).toEqual([{ id: 'lot-1', quantity: 1, expiryDate: null }]);
    expect(p.merged).toBe(1);
  });

  it('drops the stale expiry when merging into a used-up lot', () => {
    const p = plan(
      [item()],
      [lot({ quantity: 0, unit: 'liters', expiryDate: new Date('2026-10-12T00:00:00.000Z') })],
    );
    expect(p.updates).toEqual([{ id: 'lot-1', quantity: 1, expiryDate: null }]);
  });

  it('prefers an in-stock lot over a used-up lot with an earlier expiry', () => {
    const p = plan(
      [item()],
      [
        lot({ id: 'empty', quantity: 0, unit: 'liters', expiryDate: new Date('2026-10-10T00:00:00.000Z') }),
        lot({ id: 'stock', quantity: 1, unit: 'liters', expiryDate: new Date('2026-10-20T00:00:00.000Z') }),
      ],
    );
    expect(p.updates).toEqual([{ id: 'stock', quantity: 2 }]);
  });

  it('does not merge across families', () => {
    const p = plan(
      [item({ itemName: 'Rice', quantity: 2, unit: 'pieces' })],
      [lot({ ingredientName: 'rice', quantity: 1, unit: 'kg' })],
    );
    expect(p.updates).toHaveLength(0);
    expect(p.creates).toHaveLength(1);
  });

  it('matches using the coerced unit (can -> pieces)', () => {
    const p = plan(
      [item({ itemName: 'Tomato paste', quantity: 2, unit: 'can' })],
      [lot({ ingredientName: 'tomato paste', quantity: 1, unit: 'pieces' })],
    );
    expect(p.updates).toEqual([{ id: 'lot-1', quantity: 3 }]);
    expect(p.creates).toHaveLength(0);
  });

  it('does not touch lots of other ingredients', () => {
    const p = plan([item()], [lot({ ingredientName: 'oat milk' })]);
    expect(p.updates).toHaveLength(0);
    expect(p.creates).toHaveLength(1);
  });
});

describe('planPantryMerge: create', () => {
  it('merges same-trip duplicates into one create', () => {
    const p = plan([
      item({ itemName: 'Eggs', quantity: 6, unit: 'pieces' }),
      item({ itemName: 'eggs', quantity: 6, unit: 'pieces' }),
    ]);
    expect(p.creates).toHaveLength(1);
    expect(p.creates[0].quantity).toBe(12);
    expect(p.added).toBe(1);
    expect(p.merged).toBe(0);
  });

  it('merges a same-trip duplicate that also exists as a lot into the lot once', () => {
    const p = plan([item(), item({ quantity: 2 })], [lot({ unit: 'liters', quantity: 1 })]);
    expect(p.updates).toEqual([{ id: 'lot-1', quantity: 4 }]);
    expect(p.merged).toBe(2);
    expect(p.creates).toHaveLength(0);
  });

  it('fills create fields', () => {
    const p = plan([
      item({
        itemName: '  Tomato paste ',
        quantity: 2,
        unit: 'can',
        category: 'canned',
        actualCostCents: 250,
        costEstimateCents: 300,
      }),
    ]);
    expect(p.creates[0]).toEqual({
      ingredientName: 'Tomato paste',
      quantity: 2,
      unit: 'pieces',
      category: 'canned',
      purchaseDate: PURCHASE,
      purchasePriceCents: 250,
      notes: 'Bought as 2 can',
    });
  });

  it.each([
    [{ actualCostCents: null, costEstimateCents: 300 }, 300],
    [{ actualCostCents: null, costEstimateCents: null }, null],
  ])('price fallback %p', (over, expected) => {
    expect(plan([item(over)]).creates[0].purchasePriceCents).toBe(expected);
  });

  it.each([
    [null, 'dairy'],
    ['not-a-category', 'dairy'],
  ])('category %p falls back to inferCategory', (category, expected) => {
    expect(plan([item({ category })]).creates[0].category).toBe(expected);
  });

  it('caps the name at 100 chars and keeps notes null for plain units', () => {
    const c = plan([item({ itemName: 'x'.repeat(150) })]).creates[0];
    expect(c.ingredientName).toHaveLength(100);
    expect(c.notes).toBeNull();
  });
});

describe('planPantryMerge: skips and bounds', () => {
  it.each([
    ['blank name', { itemName: '   ' }],
    ['zero quantity', { quantity: 0 }],
    ['negative quantity', { quantity: -2 }],
    ['non-numeric quantity', { quantity: 'abc' }],
    ['null quantity', { quantity: null }],
  ])('skips %s', (_label, over) => {
    const p = plan([item(over as Partial<CheckedItem>)]);
    expect(p).toMatchObject({ added: 0, merged: 0, skipped: 1 });
    expect(p.creates).toHaveLength(0);
  });

  it('clamps to 99999 and rounds to 2 dp', () => {
    expect(plan([item({ quantity: 1000000 })]).creates[0].quantity).toBe(99999);
    expect(plan([item({ quantity: '1.005' })]).creates[0].quantity).toBe(1.01);
  });

  it('clamps merged totals to 99999', () => {
    const p = plan([item({ quantity: 99999, unit: 'ml' })], [lot({ quantity: 50 })]);
    expect(p.updates[0].quantity).toBe(99999);
  });

  it('does not mutate frozen inputs', () => {
    expect(() => plan([item(), item({ itemName: 'Eggs', unit: 'pieces' })], [lot()])).not.toThrow();
  });
});
