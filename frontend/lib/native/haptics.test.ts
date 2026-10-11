import { describe, expect, it, vi } from 'vitest';
import { createHaptics, HAPTIC_THROTTLE_MS, type HapticEngine } from './haptics';
import { HAPTICS_ENABLED_KEY, readHapticsEnabled, writeHapticsEnabled } from './haptic-prefs';

function makeEngine(): HapticEngine {
  return {
    impactLight: vi.fn().mockResolvedValue(undefined),
    notifySuccess: vi.fn().mockResolvedValue(undefined),
    notifyWarning: vi.fn().mockResolvedValue(undefined),
    selection: vi.fn().mockResolvedValue(undefined),
  };
}

function setup(over: Partial<{ native: boolean; enabled: boolean; engine: HapticEngine | null }> = {}) {
  const engine = over.engine === undefined ? makeEngine() : over.engine;
  let t = 1000;
  const loadEngine = vi.fn().mockResolvedValue(engine);
  const haptic = createHaptics({
    isNative: () => over.native ?? true,
    isEnabled: () => over.enabled ?? true,
    now: () => t,
    loadEngine,
  });
  return { engine, loadEngine, haptic, advance: (ms: number) => (t += ms) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createHaptics', () => {
  it('is a no-op on web and never loads the engine', async () => {
    const s = setup({ native: false });
    s.haptic('light');
    await flush();
    expect(s.loadEngine).not.toHaveBeenCalled();
  });

  it('is a no-op when disabled', async () => {
    const s = setup({ enabled: false });
    s.haptic('success');
    await flush();
    expect(s.loadEngine).not.toHaveBeenCalled();
    expect((s.engine as HapticEngine).notifySuccess).not.toHaveBeenCalled();
  });

  it.each([
    ['light', 'impactLight'],
    ['success', 'notifySuccess'],
    ['warning', 'notifyWarning'],
    ['selection', 'selection'],
  ] as const)('maps %s to %s', async (kind, method) => {
    const s = setup();
    s.haptic(kind);
    await flush();
    expect((s.engine as HapticEngine)[method]).toHaveBeenCalledTimes(1);
  });

  it('throttles within 80 ms and fires at 80 ms', async () => {
    const s = setup();
    s.haptic('light');
    s.advance(HAPTIC_THROTTLE_MS - 1);
    s.haptic('light');
    await flush();
    expect((s.engine as HapticEngine).impactLight).toHaveBeenCalledTimes(1);
    s.advance(1);
    s.haptic('light');
    await flush();
    expect((s.engine as HapticEngine).impactLight).toHaveBeenCalledTimes(2);
  });

  it('swallows engine rejections and keeps working', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const engine = makeEngine();
    (engine.impactLight as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('bad'));
    const s = setup({ engine });
    s.haptic('light');
    await flush();
    s.advance(100);
    s.haptic('light');
    await flush();
    expect(engine.impactLight).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('does not throw when the engine is null', async () => {
    const s = setup({ engine: null });
    expect(() => s.haptic('light')).not.toThrow();
    await flush();
  });
});

describe('haptic prefs', () => {
  it('defaults to true when missing', () => {
    expect(readHapticsEnabled({ getItem: () => null, setItem: () => {} })).toBe(true);
  });
  it('reads false', () => {
    expect(readHapticsEnabled({ getItem: () => 'false', setItem: () => {} })).toBe(false);
  });
  it('defaults to true when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {},
    };
    expect(readHapticsEnabled(storage)).toBe(true);
  });
  it('writes the flag', () => {
    const setItem = vi.fn();
    expect(writeHapticsEnabled({ getItem: () => null, setItem }, false)).toBe(true);
    expect(setItem).toHaveBeenCalledWith(HAPTICS_ENABLED_KEY, 'false');
  });
});
