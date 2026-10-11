import { describe, expect, it } from 'vitest';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import { applyResult } from './apply-result';
import { pantryItem } from './fixtures.test-helper';

// IN-05: a create applied before its optimistic row landed must still appear in the cache.
const create = makeOp({
  kind: 'pantry.create',
  label: 'Rice',
  payload: { item: { id: ID_A, ingredientName: 'Rice', category: 'grains', quantity: 2, unit: 'kg' } },
});

describe('applyResult pantry.create', () => {
  it('appends the server row when the item is not cached yet', () => {
    const [write] = applyResult(create, pantryItem(2));
    const next = write.update([]) as { id: string; quantity: number }[];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: ID_A, quantity: 2 });
  });

  it('replaces the optimistic row in place when present', () => {
    const [write] = applyResult(create, pantryItem(3));
    const next = write.update([pantryItem(2)]) as { quantity: number }[];
    expect(next).toHaveLength(1);
    expect(next[0].quantity).toBe(3);
  });
});
