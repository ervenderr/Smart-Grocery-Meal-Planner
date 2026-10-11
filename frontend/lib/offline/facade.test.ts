import { describe, expect, it, vi } from 'vitest';
import { offlineWrite, offlineWriteMany } from './facade';
import type { OfflineRuntime } from './runtime';

const NEW_OP = { kind: 'pantry.delete', label: 'Rice', payload: { id: '11111111-1111-4111-8111-111111111111' } } as const;

describe('offlineWrite', () => {
  it('enqueues on the runtime and never calls direct', async () => {
    const enqueue = vi.fn().mockResolvedValue({ seq: 1 });
    const direct = vi.fn();
    const out = await offlineWrite({ op: () => NEW_OP, direct }, { enqueue } as unknown as OfflineRuntime);
    expect(enqueue).toHaveBeenCalledWith(NEW_OP);
    expect(direct).not.toHaveBeenCalled();
    expect(out).toEqual({ mode: 'queued', op: { seq: 1 } });
  });

  it('calls direct and never evaluates op() without a runtime', async () => {
    const op = vi.fn(() => NEW_OP);
    const direct = vi.fn().mockResolvedValue('server');
    const out = await offlineWrite({ op, direct }, null);
    expect(op).not.toHaveBeenCalled();
    expect(out).toEqual({ mode: 'direct', result: 'server' });
  });

  it('propagates direct errors', async () => {
    await expect(offlineWrite({ op: () => NEW_OP, direct: () => Promise.reject(new Error('x')) }, null)).rejects.toThrow('x');
  });
});

describe('offlineWriteMany', () => {
  it('enqueues every op in order', async () => {
    const enqueue = vi.fn().mockResolvedValueOnce({ seq: 1 }).mockResolvedValueOnce({ seq: 2 });
    const out = await offlineWriteMany(
      { ops: () => [NEW_OP, NEW_OP], direct: vi.fn() },
      { enqueue } as unknown as OfflineRuntime,
    );
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ mode: 'queued', op: { seq: 2 } });
  });

  it('queues nothing for an empty op list', async () => {
    const enqueue = vi.fn();
    const out = await offlineWriteMany({ ops: () => [], direct: vi.fn() }, { enqueue } as unknown as OfflineRuntime);
    expect(enqueue).not.toHaveBeenCalled();
    expect(out).toEqual({ mode: 'queued', op: null });
  });

  it('goes direct without a runtime and skips ops()', async () => {
    const ops = vi.fn(() => [NEW_OP]);
    const out = await offlineWriteMany({ ops, direct: async () => 'ok' }, null);
    expect(ops).not.toHaveBeenCalled();
    expect(out).toEqual({ mode: 'direct', result: 'ok' });
  });
});
