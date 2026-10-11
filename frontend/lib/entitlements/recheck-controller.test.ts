import { describe, expect, it } from 'vitest';
import type { EntitlementStatus } from '@/lib/api/entitlements';
import type { RecheckResult } from '@/lib/native/store/store-service';
import { createRecheckController } from './recheck-controller';

function setup(results: RecheckResult[] = ['verified']) {
  let clock = 0;
  const calls: EntitlementStatus[] = [];
  let i = 0;
  const controller = createRecheckController({
    run: async (status) => {
      calls.push(status);
      const r = results[Math.min(i, results.length - 1)];
      i += 1;
      return r;
    },
    now: () => clock,
    minIntervalMs: 1000,
  });
  return { controller, calls, advance: (ms: number) => (clock += ms) };
}

describe('createRecheckController (WR-07)', () => {
  it('runs once on mount with the server status', async () => {
    const s = setup();
    expect(await s.controller.trigger('mount', 'none')).toBe('verified');
    expect(s.calls).toEqual(['none']);
  });

  it('debounces resume and online triggers inside the interval', async () => {
    const s = setup(['skipped']);
    await s.controller.trigger('mount', 'active');
    expect(await s.controller.trigger('resume', 'active')).toBe('debounced');
    expect(await s.controller.trigger('online', 'active')).toBe('debounced');
    s.advance(1000);
    expect(await s.controller.trigger('resume', 'active')).toBe('skipped');
    expect(s.calls).toHaveLength(2);
  });

  it('never runs two at once', async () => {
    let release: (r: RecheckResult) => void = () => undefined;
    const controller = createRecheckController({
      run: () => new Promise<RecheckResult>((r) => (release = r)),
      now: () => 0,
      minIntervalMs: 0,
    });
    const first = controller.trigger('mount', 'none');
    expect(await controller.trigger('resume', 'none')).toBe('in-flight');
    release('pending');
    expect(await first).toBe('pending');
  });

  it('stops for the session after claimed-elsewhere', async () => {
    const s = setup(['claimed-elsewhere', 'verified']);
    expect(await s.controller.trigger('mount', 'none')).toBe('claimed-elsewhere');
    s.advance(10_000);
    expect(await s.controller.trigger('resume', 'none')).toBe('stopped');
    expect(await s.controller.trigger('mount', 'none')).toBe('stopped');
    expect(s.calls).toHaveLength(1);
  });

  it('a throwing run reports failed and does not wedge the controller', async () => {
    let n = 0;
    const controller = createRecheckController({
      run: async () => {
        n += 1;
        if (n === 1) throw new Error('boom');
        return 'verified';
      },
      now: () => n * 10_000,
      minIntervalMs: 1000,
    });
    expect(await controller.trigger('mount', 'none')).toBe('failed');
    expect(await controller.trigger('resume', 'none')).toBe('verified');
  });
});
