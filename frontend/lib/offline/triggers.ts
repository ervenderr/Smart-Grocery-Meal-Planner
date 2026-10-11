import { loadPlugin } from '@/lib/platform/native';
import type { ConnectivityState } from './connectivity/connectivity';
import { attachNativeNetwork } from './connectivity/native-network';
import type { OfflineRuntime } from './runtime';

interface AppLike {
  addListener(
    event: 'appStateChange',
    cb: (s: { isActive: boolean }) => void,
  ): Promise<{ remove(): Promise<void> | void }>;
}

export interface TriggerDeps {
  loadApp?: () => Promise<{ App: AppLike } | null>;
  attachNetwork?: (c: OfflineRuntime['connectivity']) => Promise<() => void>;
}

const defaultLoadApp = () =>
  loadPlugin(() => import('@capacitor/app') as unknown as Promise<{ App: AppLike }>);

/** Wires foreground, background and connectivity-regain triggers. Returns a remover. */
export async function attachTriggers(runtime: OfflineRuntime, deps: TriggerDeps = {}): Promise<() => void> {
  const loadApp = deps.loadApp ?? defaultLoadApp;
  const attachNetwork = deps.attachNetwork ?? ((c) => attachNativeNetwork(c));
  const removers: Array<() => void> = [];

  let last: ConnectivityState = runtime.connectivity.getState();
  removers.push(
    runtime.connectivity.subscribe((s) => {
      const regained = last === 'offline' && s === 'online';
      last = s;
      if (regained) {
        runtime.drain.kick('online');
        void runtime.refreshFromServer('online');
      }
    }),
  );

  try {
    removers.push(await attachNetwork(runtime.connectivity));
  } catch {
    // connectivity probe still decides without the native hint
  }

  const mod = await loadApp();
  if (mod) {
    const handle = await mod.App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        runtime.drain.kick('foreground');
        void runtime.refreshFromServer('foreground');
      } else {
        void runtime.persister.flush();
      }
    });
    removers.push(() => {
      void handle.remove();
    });
  }

  return () => {
    removers.splice(0).forEach((r) => r());
  };
}
