import { describe, it, expect, vi } from 'vitest';
import { attachNativeNetwork } from './native-network';

function fakePlugin(connected: boolean) {
  let cb: ((s: { connected: boolean }) => void) | undefined;
  const remove = vi.fn().mockResolvedValue(undefined);
  const Network = {
    getStatus: vi.fn().mockResolvedValue({ connected, connectionType: 'wifi' }),
    addListener: vi.fn((_e: string, fn: typeof cb) => {
      cb = fn;
      return Promise.resolve({ remove });
    }),
  };
  return { mod: { Network }, emit: (c: boolean) => cb?.({ connected: c }), remove };
}

describe('attachNativeNetwork', () => {
  it('initial status and events become hints', async () => {
    const f = fakePlugin(false);
    const conn = { setHint: vi.fn() };
    await attachNativeNetwork(conn, async () => f.mod as never);
    expect(conn.setHint).toHaveBeenCalledWith(false);
    f.emit(true);
    expect(conn.setHint).toHaveBeenLastCalledWith(true);
  });
  it('remover removes listener', async () => {
    const f = fakePlugin(true);
    const off = await attachNativeNetwork({ setHint: vi.fn() }, async () => f.mod as never);
    off();
    expect(f.remove).toHaveBeenCalled();
  });
  it('loader null -> no-op remover', async () => {
    const conn = { setHint: vi.fn() };
    const off = await attachNativeNetwork(conn, async () => null);
    expect(conn.setHint).not.toHaveBeenCalled();
    expect(() => off()).not.toThrow();
  });
});
