import { describe, expect, it, vi } from 'vitest';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import type { NewOp, OutboxOp } from '../outbox/op-types';
import { discardAllFailed, discardOp, retryAll, retryOp } from './actions';

const mk = (over: Partial<OutboxOp> = {}): OutboxOp =>
  makeOp({ kind: 'pantry.create', payload: { item: { id: ID_A, ingredientName: 'x', category: 'other', quantity: 1, unit: 'items' } }, label: 'x' } as NewOp, over);

function fakeRuntime(opts: { list?: OutboxOp[]; discarded?: OutboxOp[] } = {}) {
  return {
    store: {
      retry: vi.fn(async () => undefined),
      discard: vi.fn(async () => opts.discarded ?? []),
      discardAllFailed: vi.fn(async () => opts.discarded ?? []),
      list: vi.fn(async () => opts.list ?? []),
    },
    drain: { kick: vi.fn() },
    applyWrites: vi.fn(),
  };
}

describe('status actions', () => {
  it('retryOp retries then kicks the drain', async () => {
    const rt = fakeRuntime();
    await retryOp(rt as never, 5);
    expect(rt.store.retry).toHaveBeenCalledWith(5);
    expect(rt.drain.kick).toHaveBeenCalledWith('retry');
    expect(rt.store.retry.mock.invocationCallOrder[0]).toBeLessThan(rt.drain.kick.mock.invocationCallOrder[0]);
  });

  it('discardOp rolls back the op and its dependents and returns the count', async () => {
    const rt = fakeRuntime({ discarded: [mk({ seq: 1, inverse: {} }), mk({ seq: 2, inverse: {} })] });
    const n = await discardOp(rt as never, 1);
    expect(n).toBe(2);
    expect(rt.applyWrites).toHaveBeenCalledTimes(2);
    const first = (rt.applyWrites.mock.calls as unknown[][])[0][0] as unknown[];
    expect(first.length).toBeGreaterThan(0);
  });

  it('discardAllFailed rolls back everything it returns', async () => {
    const rt = fakeRuntime({ discarded: [mk(), mk(), mk()] });
    expect(await discardAllFailed(rt as never, 'u1')).toBe(3);
    expect(rt.store.discardAllFailed).toHaveBeenCalledWith('u1');
    expect(rt.applyWrites).toHaveBeenCalledTimes(3);
  });

  it('discard with nothing returned rolls back nothing', async () => {
    const rt = fakeRuntime();
    expect(await discardOp(rt as never, 9)).toBe(0);
    expect(rt.applyWrites).not.toHaveBeenCalled();
  });

  it('retryAll retries only retryable failed ops and kicks', async () => {
    const list = [
      mk({ seq: 1, state: 'failed', lastError: { reason: 'conflict' } }),
      mk({ seq: 2, state: 'failed', lastError: { reason: 'gone' } }),
      mk({ seq: 3, state: 'queued' }),
      mk({ seq: 4, state: 'failed', lastError: { reason: 'max-attempts' } }),
    ];
    const rt = fakeRuntime({ list });
    expect(await retryAll(rt as never, 'u1')).toBe(2);
    expect((rt.store.retry.mock.calls as unknown[][]).map((c) => c[0])).toEqual([1, 4]);
    expect(rt.drain.kick).toHaveBeenCalledWith('retry');
  });
});
