import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

/** Auth endpoints whose 401 must never trigger a refresh. */
export const AUTH_URL_PATTERNS = ['/auth/login', '/auth/signup', '/auth/refresh'] as const;

export type RefreshOutcome =
  | { kind: 'refreshed'; token: string }
  | { kind: 'definitive' }
  | { kind: 'transient'; error: unknown };

interface RefreshedTokens {
  token: string;
  refreshToken: string;
}

export interface RefreshCoordinatorDeps {
  readRefreshToken: () => string | null;
  refreshRequest: (refreshToken: string) => Promise<RefreshedTokens>;
  writeTokens: (tokens: RefreshedTokens) => void;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/**
 * Only a 401/403 from the refresh endpoint proves the session is gone.
 * Network errors, timeouts, 5xx and 429 are transient and must not clear state.
 */
export function classifyRefreshFailure(error: unknown): 'definitive' | 'transient' {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 401 || status === 403 ? 'definitive' : 'transient';
}

/** Single-flight refresh: concurrent callers share one in-flight request. */
export function createRefreshCoordinator(deps: RefreshCoordinatorDeps) {
  let inFlight: Promise<RefreshOutcome> | null = null;

  async function run(): Promise<RefreshOutcome> {
    const refreshToken = deps.readRefreshToken();
    if (!refreshToken) return { kind: 'definitive' };
    try {
      const tokens = await deps.refreshRequest(refreshToken);
      deps.writeTokens(tokens);
      return { kind: 'refreshed', token: tokens.token };
    } catch (error) {
      if (classifyRefreshFailure(error) === 'definitive') return { kind: 'definitive' };
      return { kind: 'transient', error };
    }
  }

  return {
    refresh(): Promise<RefreshOutcome> {
      if (!inFlight) {
        inFlight = run().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}

export interface AuthErrorHandlerDeps {
  coordinator: { refresh: () => Promise<RefreshOutcome> };
  retry: (config: RetriableConfig) => Promise<unknown>;
  onSessionExpired: () => void;
  authUrlPatterns?: readonly string[];
}

/** Returns a handler for 401 responses: refresh once, retry once, expire only on definitive failure. */
export function createAuthErrorHandler(deps: AuthErrorHandlerDeps) {
  const patterns = deps.authUrlPatterns ?? AUTH_URL_PATTERNS;

  return async (error: AxiosError): Promise<unknown> => {
    const config = error.config as RetriableConfig | undefined;
    const url = config?.url ?? '';

    if (error.response?.status !== 401 || !config) throw error;
    if (patterns.some((p) => url.includes(p))) throw error;
    if (config._retry) throw error;

    const outcome = await deps.coordinator.refresh();
    if (outcome.kind === 'refreshed') {
      const existing = (config.headers ?? {}) as Record<string, unknown>;
      const headers = { ...existing, Authorization: `Bearer ${outcome.token}` };
      return deps.retry({ ...config, headers, _retry: true } as RetriableConfig);
    }
    if (outcome.kind === 'definitive') deps.onSessionExpired();
    throw error;
  };
}
