import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeSessionEndIntent,
  notifySessionCleared,
  notifySessionClearing,
  registerSessionHandlers,
  setSessionEndIntent,
} from './session-hooks';

afterEach(() => {
  registerSessionHandlers(null);
  consumeSessionEndIntent();
});

describe('session hooks', () => {
  it('defaults the intent to expired', () => {
    expect(consumeSessionEndIntent()).toBe('expired');
  });

  it('returns the set intent once, then resets', () => {
    setSessionEndIntent('logout');
    expect(consumeSessionEndIntent()).toBe('logout');
    expect(consumeSessionEndIntent()).toBe('expired');
  });

  it('calls handlers in order', () => {
    const calls: string[] = [];
    registerSessionHandlers({ beforeClear: () => calls.push('before'), afterClear: () => calls.push('after') });
    notifySessionClearing();
    notifySessionCleared();
    expect(calls).toEqual(['before', 'after']);
  });

  it('is a no-op without handlers or after null registration', () => {
    const fn = vi.fn();
    registerSessionHandlers({ beforeClear: fn, afterClear: fn });
    registerSessionHandlers(null);
    expect(() => {
      notifySessionClearing();
      notifySessionCleared();
    }).not.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });
});
