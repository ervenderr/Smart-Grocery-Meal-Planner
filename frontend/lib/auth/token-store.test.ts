import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTokenStore, type SecureBackend } from './token-store';

function setup(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const backend = {
    get: vi.fn(async (k: string) => data.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      data.set(k, v);
    }),
    remove: vi.fn(async (k: string) => {
      data.delete(k);
    }),
  } satisfies SecureBackend;
  return { data, backend, store: createTokenStore(backend) };
}

afterEach(() => vi.restoreAllMocks());

describe('createTokenStore', () => {
  it('is not ready and returns null before init', () => {
    const { store } = setup({ access: 'A' });
    expect(store.isReady()).toBe(false);
    expect(store.getAccess()).toBeNull();
    expect(store.getRefresh()).toBeNull();
  });

  it('init loads both tokens and becomes ready', async () => {
    const { store } = setup({ access: 'A', refresh: 'R' });
    const result = await store.init();
    expect(result.readFailed).toBe(false);
    expect(result.snapshot).toEqual({ access: 'A', refresh: 'R' });
    expect(store.isReady()).toBe(true);
    expect(store.getAccess()).toBe('A');
    expect(store.getRefresh()).toBe('R');
  });

  it('concurrent init calls share one promise and read once', async () => {
    const { store, backend } = setup({ access: 'A', refresh: 'R' });
    const [a, b] = [store.init(), store.init()];
    expect(a).toBe(b);
    await a;
    expect(backend.get).toHaveBeenCalledTimes(2);
  });

  it('init with a failing backend resolves readFailed and logs no token', async () => {
    const { store, backend } = setup();
    backend.get.mockRejectedValue(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await store.init();
    expect(result).toEqual({ readFailed: true, snapshot: { access: null, refresh: null } });
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain('SECRET');
  });

  it('a failed init is not memoized and a later init recovers tokens', async () => {
    const { store, backend } = setup({ access: 'A', refresh: 'R' });
    backend.get.mockRejectedValueOnce(new Error('locked'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await store.init()).readFailed).toBe(true);
    backend.get.mockImplementation(async (k: string) => (k === 'access' ? 'A' : 'R'));
    const retry = await store.init();
    expect(retry.readFailed).toBe(false);
    expect(store.getAccess()).toBe('A');
    expect(store.getRefresh()).toBe('R');
  });

  it('set updates memory synchronously and writes through', async () => {
    const { store, backend } = setup();
    const p = store.set({ token: 'A', refreshToken: 'R' });
    expect(store.getAccess()).toBe('A');
    expect(store.getRefresh()).toBe('R');
    await p;
    expect(backend.set).toHaveBeenCalledWith('access', 'A');
    expect(backend.set).toHaveBeenCalledWith('refresh', 'R');
  });

  it('set without refreshToken keeps refresh and writes only access', async () => {
    const { store, backend } = setup();
    await store.set({ token: 'A', refreshToken: 'R' });
    backend.set.mockClear();
    await store.set({ token: 'B' });
    expect(store.getAccess()).toBe('B');
    expect(store.getRefresh()).toBe('R');
    expect(backend.set).toHaveBeenCalledTimes(1);
    expect(backend.set).toHaveBeenCalledWith('access', 'B');
  });

  it('set replaces the snapshot object (immutability)', async () => {
    const { store } = setup({ access: 'A', refresh: 'R' });
    const before = (await store.init()).snapshot;
    await store.set({ token: 'B' });
    expect(before).toEqual({ access: 'A', refresh: 'R' });
    expect(Object.isFrozen(before)).toBe(true);
  });

  it('set survives backend failure and logs without the token', async () => {
    const { store, backend } = setup();
    backend.set.mockRejectedValue(new Error('disk full'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(store.set({ token: 'SECRET-A', refreshToken: 'SECRET-R' })).resolves.toBeUndefined();
    expect(store.getAccess()).toBe('SECRET-A');
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain('SECRET');
  });

  it('clear nulls getters synchronously and removes both keys', async () => {
    const { store, backend } = setup();
    await store.set({ token: 'A', refreshToken: 'R' });
    const p = store.clear();
    expect(store.getAccess()).toBeNull();
    expect(store.getRefresh()).toBeNull();
    await p;
    expect(backend.remove).toHaveBeenCalledWith('access');
    expect(backend.remove).toHaveBeenCalledWith('refresh');
  });

  it('clear swallows and logs remove failures', async () => {
    const { store, backend } = setup();
    backend.remove.mockRejectedValue(new Error('nope'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(store.clear()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it('flush waits for pending writes in order (set then clear leaves backend empty)', async () => {
    const { store, data } = setup();
    void store.set({ token: 'A', refreshToken: 'R' });
    void store.clear();
    await store.flush();
    expect(data.size).toBe(0);
  });
});
