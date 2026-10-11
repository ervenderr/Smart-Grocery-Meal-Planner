import { afterEach, describe, expect, it, vi } from 'vitest';
import * as enabled from './enabled';
import { BOOT_TIMEOUT_MS } from './boot';
import { offlineWrite, offlineWriteMany } from './facade';
import { setOfflineRuntime, type OfflineRuntime } from './runtime';

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

describe('runtime readiness on native', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setOfflineRuntime(null);
  });

  it('waits for the runtime to boot instead of going direct', async () => {
    vi.spyOn(enabled, 'isOfflineEnabled').mockReturnValue(true);
    const enqueue = vi.fn().mockResolvedValue({ seq: 7 });
    const direct = vi.fn();
    const pending = offlineWrite({ op: () => NEW_OP, direct });
    setOfflineRuntime({ enqueue } as unknown as OfflineRuntime);
    expect(await pending).toEqual({ mode: 'queued', op: { seq: 7 } });
    expect(direct).not.toHaveBeenCalled();
  });

  it('falls back to direct after the boot timeout', async () => {
    vi.useFakeTimers();
    vi.spyOn(enabled, 'isOfflineEnabled').mockReturnValue(true);
    const direct = vi.fn().mockResolvedValue('server');
    const pending = offlineWrite({ op: () => NEW_OP, direct });
    await vi.advanceTimersByTimeAsync(BOOT_TIMEOUT_MS);
    expect(await pending).toEqual({ mode: 'direct', result: 'server' });
  });

  it('does not wait on web', async () => {
    vi.spyOn(enabled, 'isOfflineEnabled').mockReturnValue(false);
    const direct = vi.fn().mockResolvedValue('server');
    expect(await offlineWrite({ op: () => NEW_OP, direct })).toEqual({ mode: 'direct', result: 'server' });
  });

  it('offlineWriteMany also waits for the runtime', async () => {
    vi.spyOn(enabled, 'isOfflineEnabled').mockReturnValue(true);
    const enqueue = vi.fn().mockResolvedValue({ seq: 1 });
    const pending = offlineWriteMany({ ops: () => [NEW_OP], direct: vi.fn() });
    setOfflineRuntime({ enqueue } as unknown as OfflineRuntime);
    expect(await pending).toMatchObject({ mode: 'queued' });
  });
});
