import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedCommitter } from './debounced-commit';

describe('createDebouncedCommitter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('coalesces rapid changes into one commit with the final value', async () => {
    const commit = vi.fn(async () => undefined);
    const c = createDebouncedCommitter({ delayMs: 400, getCommit: () => commit, onSettled: vi.fn() });
    c.change(1);
    c.change(2);
    c.change(3);
    await vi.advanceTimersByTimeAsync(400);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(3);
  });

  it('flush sends a waiting change immediately and only once', async () => {
    const commit = vi.fn(async () => undefined);
    const c = createDebouncedCommitter({ delayMs: 400, getCommit: () => commit, onSettled: vi.fn() });
    c.change(5);
    c.flush();
    c.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(5);
  });

  it('flush is a no-op when nothing is waiting', async () => {
    const commit = vi.fn(async () => undefined);
    const c = createDebouncedCommitter({ delayMs: 400, getCommit: () => commit, onSettled: vi.fn() });
    c.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(commit).not.toHaveBeenCalled();
  });

  it('serialises commits so a slow earlier write finishes before the next starts', async () => {
    const log: string[] = [];
    const commit = vi.fn(async (v: number) => {
      log.push(`start:${v}`);
      await new Promise((r) => setTimeout(r, v === 1 ? 1000 : 10));
      log.push(`end:${v}`);
    });
    const c = createDebouncedCommitter({ delayMs: 400, getCommit: () => commit, onSettled: vi.fn() });
    c.change(1);
    await vi.advanceTimersByTimeAsync(400);
    c.change(2);
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(2000);
    expect(log).toEqual(['start:1', 'end:1', 'start:2', 'end:2']);
  });

  it('keeps going after a failed commit and reports settle', async () => {
    const onSettled = vi.fn();
    const commit = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
    const c = createDebouncedCommitter({ delayMs: 100, getCommit: () => commit, onSettled });
    c.change(1);
    await vi.advanceTimersByTimeAsync(100);
    c.change(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(commit).toHaveBeenCalledTimes(2);
    expect(onSettled).toHaveBeenCalledTimes(2);
  });
});
