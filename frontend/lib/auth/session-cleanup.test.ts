import { describe, expect, it, vi } from 'vitest';
import { clearUserSessionState, USER_SCOPED_STORAGE_KEYS } from './session-cleanup';

describe('clearUserSessionState', () => {
  it('clears the whole query cache', () => {
    const cache = { clear: vi.fn() };
    clearUserSessionState(cache);
    expect(cache.clear).toHaveBeenCalledTimes(1);
  });

  it('removes every user-scoped key from both storages', () => {
    const session = { removeItem: vi.fn() };
    const local = { removeItem: vi.fn() };
    clearUserSessionState({ clear: vi.fn() }, session, local);
    for (const key of USER_SCOPED_STORAGE_KEYS) {
      expect(session.removeItem).toHaveBeenCalledWith(key);
      expect(local.removeItem).toHaveBeenCalledWith(key);
    }
  });

  it('tolerates storage that throws and still clears the cache', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cache = { clear: vi.fn() };
    const broken = {
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => clearUserSessionState(cache, broken)).not.toThrow();
    expect(cache.clear).toHaveBeenCalled();
    spy.mockRestore();
  });
});
