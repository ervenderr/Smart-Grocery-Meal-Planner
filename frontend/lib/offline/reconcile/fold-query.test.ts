import { describe, expect, it, vi } from 'vitest';
import { PANTRY_ALL_KEY, SHOPPING_ACTIVE_KEY } from '../cache/cache-keys';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import type { OutboxOp } from '../outbox/op-types';
import { applyResult } from './apply-result';
import { foldPendingOver } from './fold-query';
import { pantryItem, shoppingList } from './fixtures.test-helper';

// CR-04: every canonical write of server data must keep the pending-op overlay.
const adjust = (delta: number, over: Partial<OutboxOp> = {}) =>
  makeOp({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta } }, over);
const source = (ops: OutboxOp[]) => ({ store: { list: vi.fn(async () => ops) }, userId: 'u1' });

describe('foldPendingOver (refetch path)', () => {
  it('re-applies a pending adjust over refetched pantry data', async () => {
    const out = await foldPendingOver(PANTRY_ALL_KEY, [pantryItem(3)], source([adjust(2)]));
    expect(out[0].quantity).toBe(5);
  });

  it('returns server data unchanged without a runtime, a user, or pending ops', async () => {
    const data = [pantryItem(3)];
    expect(await foldPendingOver(PANTRY_ALL_KEY, data, { store: null, userId: 'u1' })).toBe(data);
    expect(await foldPendingOver(PANTRY_ALL_KEY, data, { store: source([]).store, userId: null })).toBe(data);
    expect(await foldPendingOver(PANTRY_ALL_KEY, data, source([]))).toBe(data);
  });

  it('re-applies a pending shopping check-off over a refetched list', async () => {
    const list = shoppingList();
    const id = list.items[0].id;
    const check = makeOp({ kind: 'shopping.item.update', label: 'Eggs', payload: { id, patch: { isChecked: true } } });
    const out = await foldPendingOver(SHOPPING_ACTIVE_KEY, list, source([check]));
    expect(out.items[0].isChecked).toBe(true);
  });
});

describe('applyResult keeps later pending ops (per-op result path)', () => {
  it('folds a still-pending later adjust over the server row', () => {
    const applied = adjust(1);
    const later = adjust(2);
    const writes = applyResult(applied, { ...pantryItem(4) }, [later]);
    const next = writes[0].update([pantryItem(3)]) as { quantity: number }[];
    expect(next[0].quantity).toBe(6);
  });

  it('ignores pending ops of other entities', () => {
    const other = makeOp({ kind: 'pantry.adjust', label: 'X', payload: { id: '9f2b8a52-8c1e-4c6e-9a53-1f0e5d3b7a19', delta: 5 } });
    const writes = applyResult(adjust(1), { ...pantryItem(4) }, [other]);
    expect((writes[0].update([pantryItem(3)]) as { quantity: number }[])[0].quantity).toBe(4);
  });
});
