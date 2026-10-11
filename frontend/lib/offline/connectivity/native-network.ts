import { loadPlugin } from '@/lib/platform/native';
import type { Connectivity } from './connectivity';

type NetworkModule = {
  Network: {
    getStatus(): Promise<{ connected: boolean }>;
    addListener(
      event: 'networkStatusChange',
      cb: (s: { connected: boolean }) => void
    ): Promise<{ remove(): Promise<void> }>;
  };
};

const defaultLoader = (): Promise<NetworkModule | null> =>
  loadPlugin(
    () =>
      (process.env.NEXT_PUBLIC_NATIVE_BUILD === '1'
        ? import('@capacitor/network')
        : Promise.resolve(null)) as unknown as Promise<NetworkModule | null>,
  );

/** Feeds the OS network hint into connectivity. No-op on web. */
export async function attachNativeNetwork(
  connectivity: Pick<Connectivity, 'setHint'>,
  loader: () => Promise<NetworkModule | null> = defaultLoader
): Promise<() => void> {
  const mod = await loader();
  if (!mod) return () => {};
  const { Network } = mod;
  try {
    const status = await Network.getStatus();
    connectivity.setHint(status.connected);
  } catch {
    // hint unavailable; the probe still decides
  }
  const handle = await Network.addListener('networkStatusChange', (s) =>
    connectivity.setHint(s.connected)
  );
  return () => {
    void handle.remove();
  };
}
