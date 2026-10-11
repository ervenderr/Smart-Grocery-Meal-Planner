import { describe, expect, it, vi } from 'vitest';
import { OfflineError } from '@/lib/api/offline-error';
import { directThenQueue, isQueueableFailure } from './direct-or-queue';

describe('isQueueableFailure', () => {
  it('treats offline, no-response and timeout errors as queueable', () => {
    expect(isQueueableFailure(new OfflineError())).toBe(true);
    expect(isQueueableFailure({ request: {}, response: undefined })).toBe(true);
    expect(isQueueableFailure({ code: 'ECONNABORTED' })).toBe(true);
    expect(isQueueableFailure({ code: 'ETIMEDOUT' })).toBe(true);
  });
  it('does not queue server responses or unknown errors', () => {
    expect(isQueueableFailure({ response: { status: 409 } })).toBe(false);
    expect(isQueueableFailure(new Error('boom'))).toBe(false);
    expect(isQueueableFailure(null)).toBe(false);
  });
});

describe('directThenQueue', () => {
  it('returns the direct result without queueing', async () => {
    const queue = vi.fn();
    const out = await directThenQueue({ send: async () => 'ok', queue, newKey: () => 'k1' });
    expect(out).toEqual({ mode: 'direct', result: 'ok' });
    expect(queue).not.toHaveBeenCalled();
  });

  it('queues with the same key after a network failure', async () => {
    const send = vi.fn().mockRejectedValue({ request: {}, response: undefined });
    const queue = vi.fn().mockResolvedValue(undefined);
    const out = await directThenQueue({ send, queue, newKey: () => 'k2' });
    expect(out).toEqual({ mode: 'queued' });
    expect(send).toHaveBeenCalledWith('k2');
    expect(queue).toHaveBeenCalledWith('k2');
  });

  it('queues after an OfflineError and after a timeout', async () => {
    for (const err of [new OfflineError(), { code: 'ECONNABORTED' }]) {
      const queue = vi.fn().mockResolvedValue(undefined);
      const out = await directThenQueue({ send: () => Promise.reject(err), queue });
      expect(out).toEqual({ mode: 'queued' });
    }
  });

  it('rethrows server errors without queueing', async () => {
    const err = { response: { status: 409 } };
    const queue = vi.fn();
    await expect(directThenQueue({ send: () => Promise.reject(err), queue })).rejects.toBe(err);
    expect(queue).not.toHaveBeenCalled();
  });

  it('generates a key when none is supplied', async () => {
    const send = vi.fn().mockResolvedValue(1);
    await directThenQueue({ send, queue: vi.fn() });
    expect(send.mock.calls[0][0]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
