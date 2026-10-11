import { describe, expect, it, vi } from 'vitest';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import type { NewOp, OutboxOp } from '../outbox/op-types';
import { createStatusSource } from './status-source';

// IN-03: when list() calls resolve out of order, the newest call must win.
const op = makeOp({ kind: 'pantry.delete', payload: { id: ID_A }, label: 'x' } as NewOp);

describe('status source refresh ordering', () => {
  it('drops an older list() result that resolves after a newer one', async () => {
    const resolvers: Array<(ops: OutboxOp[]) => void> = [];
    let storeListener: () => void = () => undefined;
    const runtime = {
      store: {
        list: vi.fn(() => new Promise<OutboxOp[]>((r) => resolvers.push(r))),
        subscribe: (l: () => void) => ((storeListener = l), () => undefined),
      },
      connectivity: { getState: () => 'online', subscribe: () => () => undefined },
      drain: { isDraining: () => false },
      onEvent: () => () => undefined,
    };
    const source = createStatusSource(runtime as never, () => 'u1');
    source.subscribe(() => undefined); // refresh #1 (initial)
    storeListener(); // refresh #2 (newer)
    resolvers[1]([]); // newer: queue empty
    await Promise.resolve();
    resolvers[0]([op]); // older, stale: one op
    await new Promise((r) => setTimeout(r, 0));
    expect(source.getSnapshot().ops).toEqual([]);
  });
});
