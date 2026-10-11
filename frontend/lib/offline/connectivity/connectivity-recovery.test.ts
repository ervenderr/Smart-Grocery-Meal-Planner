import { describe, expect, it, vi } from 'vitest';
import { createConnectivity, RECOVERY_PROBE_DELAYS_MS } from './connectivity';

// WR-08: once offline, connectivity must re-probe on its own (with backoff) and on a hint of true.
function make(probeResults: boolean[]) {
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  const probe = vi.fn(async () => probeResults.shift() ?? false);
  const forced = { on: false };
  const c = createConnectivity({
    probe,
    isForcedOffline: () => forced.on,
    now: () => 0,
    setTimer: (fn, ms) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { cleared: boolean }).cleared = true;
    },
  });
  const live = () => timers.filter((t) => !t.cleared);
  const fire = async () => {
    const [t] = live();
    t.cleared = true;
    t.fn();
    await vi.waitFor(() => expect(probe).toHaveBeenCalled());
    await Promise.resolve();
  };
  return { c, probe, timers, live, fire, forced };
}

describe('connectivity recovery probing', () => {
  it('schedules re-probes with backoff after a network failure until a probe succeeds', async () => {
    const { c, probe, live, fire } = make([false, false, true]);
    c.reportNetworkFailure();
    expect(live().map((t) => t.ms)).toEqual([RECOVERY_PROBE_DELAYS_MS[0]]);
    await fire();
    await vi.waitFor(() => expect(live().map((t) => t.ms)).toEqual([RECOVERY_PROBE_DELAYS_MS[1]]));
    await fire();
    await vi.waitFor(() => expect(live().map((t) => t.ms)).toEqual([RECOVERY_PROBE_DELAYS_MS[2]]));
    await fire();
    await vi.waitFor(() => expect(c.getState()).toBe('online'));
    expect(probe).toHaveBeenCalledTimes(3);
    expect(live()).toHaveLength(0);
  });

  it('probes immediately when the native hint flips to connected', async () => {
    const { c, probe } = make([true]);
    c.reportNetworkFailure();
    c.setHint(true);
    await vi.waitFor(() => expect(probe).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(c.getState()).toBe('online'));
  });

  it('does not schedule probes while the hint says disconnected or offline is forced, and stops on dispose', () => {
    const a = make([]);
    a.c.setHint(false);
    a.c.reportNetworkFailure();
    expect(a.live()).toHaveLength(0);
    const b = make([]);
    b.forced.on = true;
    b.c.reportNetworkFailure();
    expect(b.live()).toHaveLength(0);
    const d = make([]);
    d.c.reportNetworkFailure();
    d.c.dispose();
    expect(d.live()).toHaveLength(0);
  });
});
