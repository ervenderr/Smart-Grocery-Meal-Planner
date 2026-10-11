import { API_VERSION } from '@/lib/constants/api-routes';

export const HEALTH_PROBE_TIMEOUT_MS = 3000;

/**
 * Probe target: the API root. The origin-level /health route is registered before the CORS
 * middleware, so a capacitor://localhost fetch to it is blocked and would always read offline.
 */
export function healthUrl(apiBase: string): string {
  const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  return new URL(`/api/${API_VERSION}/`, base).toString();
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
