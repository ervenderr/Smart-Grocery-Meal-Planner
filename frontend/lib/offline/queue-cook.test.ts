import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MEAL_PLANS_ALL_KEY } from '@/lib/offline/cache/cache-keys';
import { queueCook } from '@/components/cook/queue-cook';

const MEAL = '11111111-1111-4111-8111-111111111111';
const plans: Array<{ id: string; meals: Array<{ id: string; cookedAt: string | null }> }> = [{ id: 'p', meals: [{ id: MEAL, cookedAt: null }] }];

describe('queueCook', () => {
  it('enqueues with the key and marks the meal cooked optimistically', async () => {
    const qc = new QueryClient();
    qc.setQueryData(MEAL_PLANS_ALL_KEY, plans);
    const now = new Date('2026-10-11T10:00:00.000Z');
    const enqueue = vi.fn(async (op: { payload: unknown }, _opts?: unknown) => ({ seq: 1, kind: 'cook.apply', payload: op.payload }));
    await queueCook({
      runtime: { enqueue } as never,
      queryClient: qc,
      target: { mealPlanItemId: MEAL },
      servings: 2,
      title: 'Soup',
      now,
      opts: { idempotencyKey: 'k' },
    });
    expect(enqueue.mock.calls[0][1]).toEqual({ idempotencyKey: 'k' });
    const out = qc.getQueryData<typeof plans>(MEAL_PLANS_ALL_KEY);
    expect((out?.[0].meals[0] as unknown as { cookedAt: string }).cookedAt).toBe(now.toISOString());
  });

  it('leaves the cache alone for recipe targets and null enqueue', async () => {
    const qc = new QueryClient();
    qc.setQueryData(MEAL_PLANS_ALL_KEY, plans);
    await queueCook({
      runtime: { enqueue: async () => null } as never,
      queryClient: qc,
      target: { recipeId: MEAL },
      servings: 1,
      title: 'x',
    });
    expect(qc.getQueryData(MEAL_PLANS_ALL_KEY)).toBe(plans);
  });
});
