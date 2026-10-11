import { getApiErrorCode } from '@/lib/api/errors';

export const UPGRADE_REQUIRED_CODE = 'UPGRADE_REQUIRED';
export const DEFAULT_FREE_PANTRY_LIMIT = 25;

function responseOf(error: unknown): { status?: unknown; data?: unknown } | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = (error as { response?: unknown }).response;
  return typeof response === 'object' && response !== null ? (response as { status?: unknown; data?: unknown }) : undefined;
}

/** True when the error is the server's 403 free-tier limit gate. */
export function isUpgradeRequired(error: unknown): boolean {
  return responseOf(error)?.status === 403 && getApiErrorCode(error) === UPGRADE_REQUIRED_CODE;
}

/** The free-tier limit reported by the server, or the default when absent/invalid. */
export function upgradeLimitFrom(error: unknown): number {
  const data = responseOf(error)?.data;
  const limit = typeof data === 'object' && data !== null ? (data as { limit?: unknown }).limit : undefined;
  return typeof limit === 'number' && Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_FREE_PANTRY_LIMIT;
}
