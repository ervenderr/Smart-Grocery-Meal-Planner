import { describe, expect, it, vi } from 'vitest';
import { INSTALL_MARKER_KEY, LEGACY_TOKEN_KEYS, runNativeBoot, type BootStorage } from './native-boot';
import type { SecureBackend } from './token-store';

function setup(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: BootStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
  const backend: SecureBackend = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
  return { data, storage, backend };
}

describe('runNativeBoot', () => {
  it('first launch clears Keychain, sets ISO marker', async () => {
    const { data, storage, backend } = setup();
    const result = await runNativeBoot({ storage, backend });
    expect(result.firstLaunch).toBe(true);
    expect(backend.remove).toHaveBeenCalledWith('access');
    expect(backend.remove).toHaveBeenCalledWith('refresh');
    const marker = data.get(INSTALL_MARKER_KEY) as string;
    expect(new Date(marker).toISOString()).toBe(marker);
  });

  it('marker present leaves Keychain alone', async () => {
    const { storage, backend } = setup({ [INSTALL_MARKER_KEY]: '2026-01-01T00:00:00.000Z' });
    const result = await runNativeBoot({ storage, backend });
    expect(result.firstLaunch).toBe(false);
    expect(backend.remove).not.toHaveBeenCalled();
  });

  it('always scrubs legacy token keys', async () => {
    const { data, storage, backend } = setup({
      [INSTALL_MARKER_KEY]: 'x',
      'auth-token': 'T',
      'refresh-token': 'R',
    });
    await runNativeBoot({ storage, backend });
    for (const key of LEGACY_TOKEN_KEYS) expect(data.has(key)).toBe(false);
  });

  it('rewrites auth-storage without token and isAuthenticated, keeping user', async () => {
    const { data, storage, backend } = setup({
      [INSTALL_MARKER_KEY]: 'x',
      'auth-storage': JSON.stringify({
        state: { user: { id: '1' }, token: 'SECRET', isAuthenticated: true },
        version: 0,
      }),
    });
    await runNativeBoot({ storage, backend });
    const raw = data.get('auth-storage') as string;
    expect(raw).not.toContain('SECRET');
    const parsed = JSON.parse(raw);
    expect(parsed.state).toEqual({ user: { id: '1' } });
    expect(parsed.version).toBe(0);
  });

  it('removes unparsable auth-storage', async () => {
    const { data, storage, backend } = setup({ [INSTALL_MARKER_KEY]: 'x', 'auth-storage': '{bad' });
    await runNativeBoot({ storage, backend });
    expect(data.has('auth-storage')).toBe(false);
  });

  it('resolves with undefined storage', async () => {
    const { backend } = setup();
    await expect(runNativeBoot({ storage: undefined, backend })).resolves.toEqual({ firstLaunch: false });
  });

  it('resolves when storage getItem throws', async () => {
    const { backend } = setup();
    const storage: BootStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    await expect(runNativeBoot({ storage, backend })).resolves.toBeDefined();
  });

  it('survives backend remove failure on first launch', async () => {
    const { storage, backend } = setup();
    vi.mocked(backend.remove).mockRejectedValue(new Error('x'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(runNativeBoot({ storage, backend })).resolves.toEqual({ firstLaunch: true });
  });
});
