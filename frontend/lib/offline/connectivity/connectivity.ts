export type ConnectivityState = 'online' | 'offline' | 'unknown';

export interface Connectivity {
  getState(): ConnectivityState;
  isReachable(): Promise<boolean>;
  setHint(connected: boolean): void;
  reportNetworkFailure(): void;
  reportSuccess(): void;
  subscribe(l: (s: ConnectivityState) => void): () => void;
}

interface Deps {
  probe: () => Promise<boolean>;
  isForcedOffline: () => boolean;
  now?: () => number;
  probeCacheMs?: number;
}

export function createConnectivity(deps: Deps): Connectivity {
  const now = deps.now ?? Date.now;
  const cacheMs = deps.probeCacheMs ?? 5000;
  const listeners = new Set<(s: ConnectivityState) => void>();
  let hint: boolean | null = null;
  let probed: ConnectivityState = 'unknown';
  let lastProbeAt = -Infinity;
  let inFlight: Promise<boolean> | null = null;
  let emitted: ConnectivityState = 'unknown';

  function compute(): ConnectivityState {
    if (deps.isForcedOffline()) return 'offline';
    if (hint === false) return 'offline';
    return probed;
  }

  function emit(): void {
    const next = compute();
    if (next === emitted) return;
    emitted = next;
    listeners.forEach((l) => l(next));
  }

  function runProbe(): Promise<boolean> {
    if (inFlight) return inFlight;
    inFlight = deps
      .probe()
      .catch(() => false)
      .then((ok) => {
        probed = ok ? 'online' : 'offline';
        lastProbeAt = now();
        emit();
        return ok;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return {
    getState: compute,
    async isReachable() {
      if (deps.isForcedOffline() || hint === false) {
        emit();
        return false;
      }
      if (now() - lastProbeAt < cacheMs && probed !== 'unknown') return probed === 'online';
      return runProbe();
    },
    setHint(connected) {
      hint = connected;
      if (!connected) lastProbeAt = -Infinity;
      emit();
    },
    reportNetworkFailure() {
      probed = 'offline';
      lastProbeAt = -Infinity;
      emit();
    },
    reportSuccess() {
      probed = 'online';
      lastProbeAt = now();
      if (hint === false) hint = true;
      emit();
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
