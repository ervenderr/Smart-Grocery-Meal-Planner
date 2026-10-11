import { describe, it, expect, vi, afterEach } from 'vitest';
import { healthUrl, probeHealth, HEALTH_PROBE_TIMEOUT_MS } from './probe';

afterEach(() => vi.useRealTimers());

describe('probe', () => {
  it('healthUrl targets the CORS-enabled API root, not the CORS-less /health', () => {
    expect(healthUrl('https://api.example.com/api/v1')).toBe('https://api.example.com/api/v1/');
    expect(healthUrl('https://api.example.com')).toBe('https://api.example.com/api/v1/');
  });
  it('timeout constant is 3000', () => {
    expect(HEALTH_PROBE_TIMEOUT_MS).toBe(3000);
  });
  it('200 -> true', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    expect(await probeHealth({ fetchImpl, url: 'u' })).toBe(true);
  });
  it('calls fetchImpl detached from the options object (WebKit Illegal invocation)', async () => {
    let boundTo: unknown = 'unset';
    const fetchImpl = async function (this: unknown) {
      boundTo = this;
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      return { ok: true, status: 200 };
    };
    expect(await probeHealth({ fetchImpl: fetchImpl as never, url: 'u' })).toBe(true);
    expect(boundTo).toBeUndefined();
  });
  it('503 -> false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    expect(await probeHealth({ fetchImpl, url: 'u' })).toBe(false);
  });
  it('reject -> false', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('net'));
    expect(await probeHealth({ fetchImpl, url: 'u' })).toBe(false);
  });
  it('hang -> false after timeout', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_u: string, init?: { signal?: AbortSignal }) =>
        new Promise((_res, rej) => {
          init?.signal?.addEventListener('abort', () => rej(new Error('aborted')));
        })
    );
    const p = probeHealth({ fetchImpl: fetchImpl as never, url: 'u' });
    await vi.advanceTimersByTimeAsync(3001);
    expect(await p).toBe(false);
  });
});
