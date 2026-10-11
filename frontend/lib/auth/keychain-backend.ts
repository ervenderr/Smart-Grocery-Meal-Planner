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
  // The Capacitor plugin is a Proxy: resolving a promise with it calls plugin.then(),
  // which is unimplemented natively and rejects. Always box it in a plain object.
  let ready: Promise<{ readonly plugin: Plugin } | null> | null = null;

  const configure = async (): Promise<{ readonly plugin: Plugin } | null> => {
    const mod = await loadPlugin(() => import('@aparajita/capacitor-secure-storage'));
    if (!mod) return null;
    const { SecureStorage, KeychainAccess } = mod;
    await SecureStorage.setKeyPrefix(KEY_PREFIX);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
    return { plugin: SecureStorage };
  };

  const boxedPlugin = async (): Promise<{ readonly plugin: Plugin }> => {
    try {
      const boxed = await (ready ??= configure());
      if (boxed) return boxed;
    } catch (error) {
      // Do not cache a rejected configuration: the next call must retry.
      ready = null;
      throw error;
    }
    ready = null;
    throw new Error('Secure storage unavailable');
  };

  return {
    async get(key) {
      const value = await (await boxedPlugin()).plugin.get(key, false);
      return typeof value === 'string' ? value : null;
    },
    async set(key, value) {
      await (await boxedPlugin()).plugin.set(key, value, false);
    },
    async remove(key) {
      await (await boxedPlugin()).plugin.remove(key);
    },
  };
}
