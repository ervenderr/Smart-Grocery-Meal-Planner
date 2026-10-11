export type ConnectivityState = 'online' | 'offline' | 'unknown';

export interface Connectivity {
  getState(): ConnectivityState;
  isReachable(): Promise<boolean>;
  setHint(connected: boolean): void;
  reportNetworkFailure(): void;
  reportSuccess(): void;
  subscribe(l: (s: ConnectivityState) => void): () => void;
  /** Stops background recovery probing. */
  dispose(): void;
}

interface Deps {
  probe: () => Promise<boolean>;
  isForcedOffline: () => boolean;
  now?: () => number;
  probeCacheMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** Background re-probe delays while offline (the last one repeats). */
export const RECOVERY_PROBE_DELAYS_MS: readonly number[] = [5_000, 15_000, 30_000, 60_000];

export function createConnectivity(deps: Deps): Connectivity {
  const now = deps.now ?? Date.now;
  const cacheMs = deps.probeCacheMs ?? 5000;
  const listeners = new Set<(s: ConnectivityState) => void>();
  let hint: boolean | null = null;
  let probed: ConnectivityState = 'unknown';
  let lastProbeAt = -Infinity;
  let inFlight: Promise<boolean> | null = null;
  let emitted: ConnectivityState = 'unknown';
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let recoveryTimer: unknown = null;
  let recoveryStep = 0;
  let disposed = false;

  function stopRecovery(): void {
    if (recoveryTimer !== null) clearTimer(recoveryTimer);
    recoveryTimer = null;
  }

  /** While probed offline (and the OS does not say disconnected), keep re-probing with backoff. */
  function scheduleRecovery(): void {
    stopRecovery();
    if (disposed || probed !== 'offline' || hint === false || deps.isForcedOffline()) return;
    const delay = RECOVERY_PROBE_DELAYS_MS[Math.min(recoveryStep, RECOVERY_PROBE_DELAYS_MS.length - 1)];
    recoveryStep += 1;
    recoveryTimer = setTimer(() => {
      recoveryTimer = null;
      void runProbe();
    }, delay);
  }

  function markOnline(): void {
    recoveryStep = 0;
    stopRecovery();
  }

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
        if (ok) markOnline();
        else scheduleRecovery();
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
      if (!connected) {
        lastProbeAt = -Infinity;
        stopRecovery();
      } else if (probed !== 'online' && !deps.isForcedOffline() && !disposed) {
        // The OS reports a connection again: verify now instead of waiting for the next trigger.
        recoveryStep = 0;
        void runProbe();
      }
      emit();
    },
    reportNetworkFailure() {
      probed = 'offline';
      lastProbeAt = -Infinity;
      if (recoveryTimer === null) scheduleRecovery();
      emit();
    },
    reportSuccess() {
      probed = 'online';
      lastProbeAt = now();
      if (hint === false) hint = true;
      markOnline();
      emit();
    },
    dispose() {
      disposed = true;
      stopRecovery();
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
