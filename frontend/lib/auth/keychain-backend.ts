import { loadPlugin } from '@/lib/platform/native';
import type { SecureBackend } from './token-store';

type SecureStorageModule = typeof import('@aparajita/capacitor-secure-storage');
type Plugin = SecureStorageModule['SecureStorage'];

const KEY_PREFIX = 'kitcha_';

/**
 * Keychain-backed SecureBackend. Native only: the plugin's web fallback is
 * unencrypted localStorage, so every method rejects when the plugin is
 * unavailable (web). Device-only access, no iCloud sync.
 */
export function createKeychainBackend(): SecureBackend {
  let ready: Promise<Plugin | null> | null = null;

  const configure = async (): Promise<Plugin | null> => {
    const mod = await loadPlugin(() => import('@aparajita/capacitor-secure-storage'));
    if (!mod) return null;
    const { SecureStorage, KeychainAccess } = mod;
    await SecureStorage.setKeyPrefix(KEY_PREFIX);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
    return SecureStorage;
  };

  const plugin = async (): Promise<Plugin> => {
    const p = await (ready ??= configure());
    if (!p) {
      ready = null;
      throw new Error('Secure storage unavailable');
    }
    return p;
  };

  return {
    async get(key) {
      const value = await (await plugin()).get(key, false);
      return typeof value === 'string' ? value : null;
    },
    async set(key, value) {
      await (await plugin()).set(key, value, false);
    },
    async remove(key) {
      await (await plugin()).remove(key);
    },
  };
}
