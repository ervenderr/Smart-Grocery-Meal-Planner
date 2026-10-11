import { describe, expect, it, vi } from 'vitest';
import { attachTriggers } from './triggers';
import type { OfflineRuntime } from './runtime';
import type { ConnectivityState } from './connectivity/connectivity';

function fakes() {
  let connCb: ((s: ConnectivityState) => void) | null = null;
  let appCb: ((s: { isActive: boolean }) => void) | null = null;
  let state: ConnectivityState = 'offline';
  const unsub = vi.fn();
  const removeApp = vi.fn();
  const removeNet = vi.fn();
  const runtime = {
    connectivity: {
      getState: () => state,
      subscribe: (cb: (s: ConnectivityState) => void) => {
        connCb = cb;
        return unsub;
      },
    },
    drain: { kick: vi.fn() },
    persister: { flush: vi.fn(async () => {}) },
    refreshFromServer: vi.fn(async () => 'ok'),
  } as unknown as OfflineRuntime;
  const loadApp = async () => ({
    App: {
      addListener: async (_e: 'appStateChange', cb: (s: { isActive: boolean }) => void) => {
        appCb = cb;
        return { remove: removeApp };
      },
    },
  });
  const attachNetwork = vi.fn(async () => removeNet);
  return {
    runtime,
    loadApp,
    attachNetwork,
    unsub,
    removeApp,
    removeNet,
    app: (isActive: boolean) => appCb!({ isActive }),
    conn: (s: ConnectivityState) => connCb!(s),
    setState: (s: ConnectivityState) => {
      state = s;
    },
  };
}

describe('attachTriggers', () => {
  it('app active kicks the drain and refreshes', async () => {
    const f = fakes();
    await attachTriggers(f.runtime, f);
    f.app(true);
    expect(f.runtime.drain.kick).toHaveBeenCalledWith('foreground');
    expect(f.runtime.refreshFromServer).toHaveBeenCalledWith('foreground');
  });

  it('app inactive flushes the persister only', async () => {
    const f = fakes();
    await attachTriggers(f.runtime, f);
    f.app(false);
    expect(f.runtime.persister.flush).toHaveBeenCalled();
    expect(f.runtime.drain.kick).not.toHaveBeenCalled();
  });

  it('offline to online kicks and refreshes; other transitions do not', async () => {
    const f = fakes();
    await attachTriggers(f.runtime, f);
    f.conn('unknown');
    f.conn('online');
    expect(f.runtime.drain.kick).not.toHaveBeenCalled();
    f.conn('offline');
    f.conn('online');
    expect(f.runtime.drain.kick).toHaveBeenCalledWith('online');
    expect(f.runtime.refreshFromServer).toHaveBeenCalledWith('online');
  });

  it('remover detaches every listener', async () => {
    const f = fakes();
    const off = await attachTriggers(f.runtime, f);
    off();
    expect(f.unsub).toHaveBeenCalled();
    expect(f.removeApp).toHaveBeenCalled();
    expect(f.removeNet).toHaveBeenCalled();
  });

  it('works when the App plugin is unavailable and network attach fails', async () => {
    const f = fakes();
    const off = await attachTriggers(f.runtime, {
      loadApp: async () => null,
      attachNetwork: async () => {
        throw new Error('x');
      },
    });
    expect(typeof off).toBe('function');
    off();
  });
});
