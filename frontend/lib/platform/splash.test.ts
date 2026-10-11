import { describe, expect, it, vi } from 'vitest';
import { SPLASH_MAX_MS, createSplashHider } from './splash';

function setup(hide: () => Promise<void> = () => Promise.resolve()) {
  let timerFn: (() => void) | null = null;
  const hideFn = vi.fn(hide);
  const setTimer = vi.fn((fn: () => void) => {
    timerFn = fn;
    return 1;
  });
  const clearTimer = vi.fn();
  const hider = createSplashHider({ hide: hideFn, setTimer, clearTimer });
  return { hider, hideFn, setTimer, clearTimer, fire: () => timerFn?.() };
}

describe('createSplashHider', () => {
  it('hides once on firstPaint and ignores later timer', () => {
    const s = setup();
    s.hider.start();
    s.hider.firstPaint();
    s.fire();
    expect(s.hideFn).toHaveBeenCalledTimes(1);
    expect(s.clearTimer).toHaveBeenCalled();
  });

  it('hides once when timer fires first and ignores later firstPaint', () => {
    const s = setup();
    s.hider.start();
    s.fire();
    s.hider.firstPaint();
    expect(s.hideFn).toHaveBeenCalledTimes(1);
  });

  it('does not throw and logs when hide rejects', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = setup(() => Promise.reject(new Error('boom')));
    s.hider.firstPaint();
    await Promise.resolve();
    await Promise.resolve();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('start schedules exactly one timer with SPLASH_MAX_MS', () => {
    const s = setup();
    s.hider.start();
    s.hider.start();
    expect(s.setTimer).toHaveBeenCalledTimes(1);
    expect(s.setTimer).toHaveBeenCalledWith(expect.any(Function), SPLASH_MAX_MS);
    expect(SPLASH_MAX_MS).toBe(2000);
  });
});
