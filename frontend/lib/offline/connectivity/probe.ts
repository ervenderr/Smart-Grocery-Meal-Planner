export const HEALTH_PROBE_TIMEOUT_MS = 3000;

/** Backend health lives at the origin root, not under the API prefix. */
export function healthUrl(apiBase: string): string {
  const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  return new URL('/health', base).toString();
}

type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; cache?: RequestCache }
) => Promise<{ ok: boolean; status: number }>;

export async function probeHealth(opts: {
  fetchImpl: FetchLike;
  url: string;
  timeoutMs?: number;
}): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? HEALTH_PROBE_TIMEOUT_MS);
  try {
    const res = await opts.fetchImpl(opts.url, { signal: controller.signal, cache: 'no-store' });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
