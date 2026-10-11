import { describe, expect, it, vi } from 'vitest';
import { discardOp, runSheetAction } from './actions';

// WR-12: a failing discard must surface an error instead of an unhandled rejection.
const runtime = (discard: () => Promise<unknown>) =>
  ({ store: { discard: vi.fn(discard) }, drain: { kick: vi.fn() }, applyWrites: vi.fn() }) as never;

describe('runSheetAction', () => {
  it('reports a store failure through onError and resolves', async () => {
    const onError = vi.fn();
    const done = vi.fn();
    const rt = runtime(async () => {
      throw new Error('SQLITE_BUSY');
    });
    await expect(
      runSheetAction(rt, async (r) => {
        await discardOp(r, 3);
        done();
      }, onError),
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it('runs the action and skips onError on success; no runtime is a no-op', async () => {
    const onError = vi.fn();
    const done = vi.fn();
    await runSheetAction(runtime(async () => []), async (r) => {
      await discardOp(r, 3);
      done();
    }, onError);
    expect(done).toHaveBeenCalledTimes(1);
    await runSheetAction(null, async () => done(), onError);
    expect(done).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});
