import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectivityState } from '../connectivity/connectivity';
import type { DrainEvent } from '../outbox/drain';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import type { NewOp, OutboxOp } from '../outbox/op-types';
import { createStatusSource, countOps } from './status-source';

const mk = (over: Partial<OutboxOp> = {}): OutboxOp => makeOp({ kind: 'pantry.delete', payload: { id: ID_A }, label: 'x' } as NewOp, over);

function fake(initial: OutboxOp[] = []) {
  let ops = initial;
  let state: ConnectivityState = 'online';
  const storeL = new Set<() => void>();
  const connL = new Set<(s: ConnectivityState) => void>();
  const evL = new Set<(e: DrainEvent) => void>();
  const runtime = {
    store: { list: vi.fn(async () => ops), subscribe: (l: () => void) => (storeL.add(l), () => storeL.delete(l)) },
    connectivity: { getState: () => state, subscribe: (l: (s: ConnectivityState) => void) => (connL.add(l), () => connL.delete(l)) },
    drain: { isDraining: () => false },
    onEvent: (l: (e: DrainEvent) => void) => (evL.add(l), () => evL.delete(l)),
  };
  return {
    runtime: runtime as never,
    setOps: (o: OutboxOp[]) => {
      ops = o;
      storeL.forEach((l) => l());
    },
    setConn: (s: ConnectivityState) => {
      state = s;
      connL.forEach((l) => l(s));
    },
    emit: (e: DrainEvent) => evL.forEach((l) => l(e)),
    listeners: () => storeL.size + connL.size + evL.size,
  };
}

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

describe('createStatusSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps snapshot identity stable without changes', async () => {
    const f = fake();
    const src = createStatusSource(f.runtime, () => 'u1');
    expect(src.getSnapshot()).toBe(src.getSnapshot());
    const first = src.getSnapshot();
    expect(first.ops).toEqual([]);
    src.subscribe(() => undefined)();
    expect(src.getSnapshot().ops).toEqual([]);
  });

  it('produces a new snapshot after a store notification', async () => {
    const f = fake();
    const src = createStatusSource(f.runtime, () => 'u1');
    const cb = vi.fn();
    const off = src.subscribe(cb);
    await flush();
    const before = src.getSnapshot();
    f.setOps([mk(), mk({ state: 'failed' })]);
    await flush();
    const after = src.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.counts).toMatchObject({ queued: 1, failed: 1 });
    expect(cb).toHaveBeenCalled();
    off();
  });

  it('tracks connectivity and draining', async () => {
    const f = fake();
    const src = createStatusSource(f.runtime, () => 'u1');
    const off = src.subscribe(() => undefined);
    f.setConn('offline');
    expect(src.getSnapshot().connectivity).toBe('offline');
    f.emit({ type: 'started' });
    expect(src.getSnapshot().draining).toBe(true);
    off();
  });

  it('flags justSynced for 2000 ms after a finished event with nothing pending', async () => {
    const f = fake([mk()]);
    const src = createStatusSource(f.runtime, () => 'u1');
    const off = src.subscribe(() => undefined);
    await flush();
    f.setOps([]);
    f.emit({ type: 'finished', applied: 1, parked: 0 });
    await flush();
    expect(src.getSnapshot().justSynced).toBe(true);
    await vi.advanceTimersByTimeAsync(1999);
    expect(src.getSnapshot().justSynced).toBe(true);
    await vi.advanceTimersByTimeAsync(2);
    expect(src.getSnapshot().justSynced).toBe(false);
    off();
  });

  it('does not flag justSynced while ops remain', async () => {
    const f = fake([mk()]);
    const src = createStatusSource(f.runtime, () => 'u1');
    const off = src.subscribe(() => undefined);
    f.emit({ type: 'finished', applied: 0, parked: 0 });
    await flush();
    expect(src.getSnapshot().justSynced).toBe(false);
    off();
  });

  it('debounces the announced count by 500 ms', async () => {
    const f = fake();
    const src = createStatusSource(f.runtime, () => 'u1');
    const off = src.subscribe(() => undefined);
    await flush();
    f.setOps([mk(), mk()]);
    await vi.advanceTimersByTimeAsync(100);
    expect(src.getSnapshot().counts.queued).toBe(2);
    expect(src.getSnapshot().announcedCount).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(src.getSnapshot().announcedCount).toBe(2);
    off();
  });

  it('detaches listeners when the last subscriber leaves and tolerates no user', async () => {
    const f = fake([mk()]);
    const src = createStatusSource(f.runtime, () => null);
    const off = src.subscribe(() => undefined);
    await flush();
    expect(f.listeners()).toBe(3);
    expect(src.getSnapshot().ops).toEqual([]);
    off();
    expect(f.listeners()).toBe(0);
  });

  it('keeps the last snapshot when listing fails', async () => {
    const f = fake();
    (f.runtime as { store: { list: ReturnType<typeof vi.fn> } }).store.list.mockRejectedValueOnce(new Error('db'));
    const src = createStatusSource(f.runtime, () => 'u1');
    const off = src.subscribe(() => undefined);
    await flush();
    expect(src.getSnapshot().ops).toEqual([]);
    off();
  });

  it('countOps counts each state', () => {
    expect(
      countOps([mk(), mk({ state: 'in_flight' }), mk({ state: 'blocked' }), mk({ state: 'paused_auth' }), mk({ state: 'failed' })]),
    ).toEqual({ queued: 1, inFlight: 1, blocked: 1, pausedAuth: 1, failed: 1 });
  });
});
