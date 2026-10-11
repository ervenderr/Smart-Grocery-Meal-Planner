import { describe, it, expect, vi } from 'vitest';
import { createConnectivity } from './connectivity';

function make(opts: { probe?: () => Promise<boolean>; forced?: boolean; t?: { now: number } } = {}) {
  const probe = vi.fn(opts.probe ?? (() => Promise.resolve(true)));
  const t = opts.t ?? { now: 0 };
  const forced = { on: opts.forced ?? false };
  const c = createConnectivity({
    probe,
    isForcedOffline: () => forced.on,
    now: () => t.now,
    probeCacheMs: 5000,
  });
  return { c, probe, t, forced };
}

describe('connectivity', () => {
  it('starts unknown', () => {
    expect(make().c.getState()).toBe('unknown');
  });
  it('forced offline -> false without probing', async () => {
    const { c, probe } = make({ forced: true });
    expect(await c.isReachable()).toBe(false);
    expect(c.getState()).toBe('offline');
    expect(probe).not.toHaveBeenCalled();
  });
  it('hint false -> offline without probe', async () => {
    const { c, probe } = make();
    c.setHint(false);
    expect(c.getState()).toBe('offline');
    expect(await c.isReachable()).toBe(false);
    expect(probe).not.toHaveBeenCalled();
  });
  it('hint true + probe true -> online', async () => {
    const { c } = make();
    c.setHint(true);
    expect(await c.isReachable()).toBe(true);
    expect(c.getState()).toBe('online');
  });
  it('hint true + probe false -> offline', async () => {
    const { c } = make({ probe: () => Promise.resolve(false) });
    c.setHint(true);
    expect(await c.isReachable()).toBe(false);
    expect(c.getState()).toBe('offline');
  });
  it('concurrent callers share one probe', async () => {
    const { c, probe } = make();
    const [a, b] = await Promise.all([c.isReachable(), c.isReachable()]);
    expect(a && b).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
  });
  it('caches probe result for probeCacheMs', async () => {
    const { c, probe, t } = make();
    await c.isReachable();
    t.now = 4000;
    await c.isReachable();
    expect(probe).toHaveBeenCalledTimes(1);
    t.now = 5001;
    await c.isReachable();
    expect(probe).toHaveBeenCalledTimes(2);
  });
  it('reportNetworkFailure sets offline and invalidates cache', async () => {
    const { c, probe } = make();
    await c.isReachable();
    c.reportNetworkFailure();
    expect(c.getState()).toBe('offline');
    await c.isReachable();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(c.getState()).toBe('online');
  });
  it('reportSuccess sets online', () => {
    const { c } = make();
    c.setHint(false);
    c.reportSuccess();
    expect(c.getState()).toBe('online');
  });
  it('forced offline wins over hint and success', () => {
    const { c, forced } = make();
    forced.on = true;
    c.reportSuccess();
    expect(c.getState()).toBe('offline');
  });
  it('notifies subscribers on change only; unsubscribe works', () => {
    const { c } = make();
    const l = vi.fn();
    const off = c.subscribe(l);
    c.setHint(false);
    c.setHint(false);
    expect(l).toHaveBeenCalledTimes(1);
    expect(l).toHaveBeenLastCalledWith('offline');
    c.reportSuccess();
    expect(l).toHaveBeenCalledTimes(2);
    off();
    c.reportNetworkFailure();
    expect(l).toHaveBeenCalledTimes(2);
  });
  it('probe rejection counts as unreachable', async () => {
    const { c } = make({ probe: () => Promise.reject(new Error('x')) });
    expect(await c.isReachable()).toBe(false);
  });
});
