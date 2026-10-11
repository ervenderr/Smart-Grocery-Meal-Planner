import { describe, expect, it } from 'vitest';
import { NewOpSchema } from '../outbox/op-types';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import { buildCookApply } from './cook-ops';
import { buildShoppingFinish, isFinishPending, localIsoDate } from './finish-ops';

const NOW = new Date(2026, 9, 11, 23, 30, 0); // local time, TZ-safe

describe('buildCookApply', () => {
  it('builds a valid op with occurredAt and inverse', () => {
    const op = buildCookApply({ target: { mealPlanItemId: ID_A }, servings: 4, title: 'Adobo', previousCookedAt: null, now: NOW });
    expect(NewOpSchema.safeParse(op).success).toBe(true);
    expect(op.label).toBe('Adobo');
    expect(op.kind).toBe('cook.apply');
    expect(op.inverse).toEqual({ previousCookedAt: null });
    expect((op.payload as { occurredAt: string }).occurredAt).toBe(NOW.toISOString());
  });
  it('keeps the previous cookedAt in the inverse', () => {
    const op = buildCookApply({ target: { recipeId: ID_A }, servings: 2, title: 'Soup', previousCookedAt: '2026-01-01T00:00:00.000Z', now: NOW });
    expect(op.inverse).toEqual({ previousCookedAt: '2026-01-01T00:00:00.000Z' });
  });
});

describe('buildShoppingFinish', () => {
  it('defaults receiptDate to the local calendar date of now', () => {
    const op = buildShoppingFinish({ input: { carryOver: 'carry' }, now: NOW });
    expect(NewOpSchema.safeParse(op).success).toBe(true);
    const input = (op.payload as { input: Record<string, unknown> }).input;
    expect(input.receiptDate).toBe('2026-10-11');
    expect(input.occurredAt).toBe(NOW.toISOString());
    expect(input.carryOver).toBe('carry');
  });
  it('keeps an explicit receiptDate', () => {
    const op = buildShoppingFinish({ input: { receiptDate: '2026-10-01' }, now: NOW });
    expect((op.payload as { input: { receiptDate: string } }).input.receiptDate).toBe('2026-10-01');
  });
  it('localIsoDate pads month and day', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('isFinishPending', () => {
  const fin = (state: Parameters<typeof makeOp>[1]) =>
    makeOp(buildShoppingFinish({ input: {}, now: NOW }), state);
  it('is true for queued, in_flight and paused_auth', () => {
    for (const state of ['queued', 'in_flight', 'paused_auth'] as const) {
      expect(isFinishPending([fin({ state })])).toBe(true);
    }
  });
  it('is false for failed, blocked-free lists and unrelated ops', () => {
    expect(isFinishPending([fin({ state: 'failed' })])).toBe(false);
    expect(isFinishPending([])).toBe(false);
    expect(isFinishPending([makeOp({ kind: 'pantry.delete', label: 'x', payload: { id: ID_A } })])).toBe(false);
  });
});
