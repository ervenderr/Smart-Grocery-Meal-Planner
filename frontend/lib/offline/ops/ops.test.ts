import { describe, expect, it } from 'vitest';
import { NewOpSchema } from '../outbox/op-types';
import { buildShoppingCreate, buildShoppingDelete, buildShoppingUpdate } from './shopping-ops';
import { buildPantryCreate, buildPantryDelete, buildPantryQuickPatchOps, buildPantryUpdate } from './pantry-ops';
import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingItem } from '@/types/shopping.types';

const ID = '11111111-1111-4111-8111-111111111111';

const shopItem: ShoppingItem = {
  id: ID,
  shoppingListId: 'l1',
  itemName: 'Milk',
  quantity: 2,
  unit: 'l',
  category: 'dairy',
  costEstimateCents: 100,
  actualCostCents: null,
  isChecked: false,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const pantry = (over: Partial<PantryItem> = {}): PantryItem => ({
  id: ID,
  userId: 'u',
  ingredientName: 'Rice',
  category: 'grains',
  quantity: 3,
  unit: 'kg',
  expiryDate: '2026-12-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const valid = (op: unknown) => expect(NewOpSchema.safeParse(op).success).toBe(true);

describe('shopping op builders', () => {
  it('create carries id and an empty inverse', () => {
    const op = buildShoppingCreate({ itemName: 'Eggs', quantity: 12 }, ID);
    valid(op);
    expect(op.kind).toBe('shopping.item.create');
    expect(op.inverse).toEqual({});
    expect(op.label).toBe('Eggs');
  });

  it('update inverse holds only patched keys', () => {
    const op = buildShoppingUpdate(shopItem, ID, { isChecked: true, quantity: 3 });
    valid(op);
    expect(op.inverse).toEqual({ previous: { isChecked: false, quantity: 2 } });
    expect(op.label).toBe('Milk');
  });

  it('update without a known item still validates', () => {
    const op = buildShoppingUpdate(undefined, ID, { isChecked: true });
    valid(op);
    expect(op.inverse).toEqual({ previous: {} });
  });

  it('delete holds the full item', () => {
    const op = buildShoppingDelete(shopItem);
    valid(op);
    expect(op.inverse).toEqual({ item: shopItem });
  });
});

describe('pantry op builders', () => {
  it('create has an empty inverse', () => {
    const op = buildPantryCreate({ ingredientName: 'Rice', category: 'grains', quantity: 2, unit: 'kg' }, ID);
    valid(op);
    expect(op.inverse).toEqual({});
  });

  it('quantity 3 -> 5 yields adjust +2 with an empty inverse', () => {
    const ops = buildPantryQuickPatchOps(pantry(), { quantity: 5 });
    expect(ops).toHaveLength(1);
    ops.forEach(valid);
    expect(ops[0]).toMatchObject({ kind: 'pantry.adjust', payload: { id: ID, delta: 2 }, inverse: {} });
  });

  it('2.5 -> 2.3 yields exactly -0.2', () => {
    const ops = buildPantryQuickPatchOps(pantry({ quantity: 2.5 }), { quantity: 2.3 });
    expect(ops[0]).toMatchObject({ payload: { delta: -0.2 } });
  });

  it('same quantity yields no adjust', () => {
    expect(buildPantryQuickPatchOps(pantry(), { quantity: 3 })).toEqual([]);
  });

  it('expiry change yields update with previous expiryDate', () => {
    const ops = buildPantryQuickPatchOps(pantry(), { expiryDate: '2027-01-01' });
    ops.forEach(valid);
    expect(ops[0]).toMatchObject({ kind: 'pantry.update', payload: { patch: { expiryDate: '2027-01-01' } }, inverse: { previous: { expiryDate: '2026-12-01' } } });
  });

  it('missing previous expiry is recorded as null', () => {
    const ops = buildPantryQuickPatchOps(pantry({ expiryDate: undefined }), { expiryDate: '2027-01-01' });
    expect(ops[0].inverse).toEqual({ previous: { expiryDate: null } });
  });

  it('buildPantryUpdate splits name and quantity into update then adjust', () => {
    const ops = buildPantryUpdate(pantry(), { ingredientName: 'Brown rice', quantity: 4 });
    ops.forEach(valid);
    expect(ops.map((o) => o.kind)).toEqual(['pantry.update', 'pantry.adjust']);
    expect(ops[0].payload).toEqual({ id: ID, patch: { ingredientName: 'Brown rice' } });
    expect(ops[0].inverse).toEqual({ previous: { ingredientName: 'Rice' } });
    expect(ops[1].payload).toEqual({ id: ID, delta: 1 });
  });

  it('buildPantryUpdate with only quantity yields a single adjust', () => {
    expect(buildPantryUpdate(pantry(), { quantity: 1 }).map((o) => o.kind)).toEqual(['pantry.adjust']);
  });

  it('delete holds the full item', () => {
    const op = buildPantryDelete(pantry());
    valid(op);
    expect(op.inverse).toEqual({ item: pantry() });
    expect(op.label).toBe('Rice');
  });
});
