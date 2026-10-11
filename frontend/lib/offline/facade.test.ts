import { describe, expect, it, vi } from 'vitest';
import { offlineWrite } from './facade';
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
