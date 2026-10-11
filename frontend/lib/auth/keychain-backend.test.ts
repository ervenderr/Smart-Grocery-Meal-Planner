import { beforeEach, describe, expect, it, vi } from 'vitest';

const setKeyPrefix = vi.fn();
const get = vi.fn();

vi.mock('@/lib/platform/native', () => ({
  loadPlugin: async () => ({
    SecureStorage: {
      setKeyPrefix: (...a: unknown[]) => setKeyPrefix(...a),
      setDefaultKeychainAccess: vi.fn(),
      get: (...a: unknown[]) => get(...a),
      set: vi.fn(),
      remove: vi.fn(),
    },
    KeychainAccess: { whenUnlockedThisDeviceOnly: 1 },
  }),
}));

import { createKeychainBackend } from './keychain-backend';

describe('createKeychainBackend', () => {
  beforeEach(() => {
    setKeyPrefix.mockReset();
    get.mockReset();
  });

  it('retries configuration after a rejected setKeyPrefix', async () => {
    setKeyPrefix.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    get.mockResolvedValue('abc');
    const backend = createKeychainBackend();

    await expect(backend.get('k')).rejects.toThrow('boom');
    await expect(backend.get('k')).resolves.toBe('abc');
    expect(setKeyPrefix).toHaveBeenCalledTimes(2);
  });
});
