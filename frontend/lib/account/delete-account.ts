import { getApiErrorCode } from '@/lib/api/errors';
import { setSessionEndIntent } from '@/lib/offline/session/session-hooks';

export type DeleteErrorKind = 'wrong_password' | 'rate_limited' | 'failed';

export const DELETED_LOGIN_PATH = '/login?deleted=1';

export const DELETE_ACCOUNT_MESSAGES: Readonly<Record<DeleteErrorKind, string>> = {
  wrong_password: 'That password is incorrect. Try again.',
  rate_limited: 'Too many attempts. Try again later.',
  failed: "We couldn't delete your account. Check your connection and try again.",
};

function getStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

export function classifyDeleteError(error: unknown): DeleteErrorKind {
  const status = getStatus(error);
  if (status === 403 && getApiErrorCode(error) === 'INVALID_PASSWORD') return 'wrong_password';
  if (status === 429) return 'rate_limited';
  return 'failed';
}

export function canSubmitDelete(password: string): boolean {
  return password.trim().length > 0;
}

/** Marks the coming session end as a deletion so local cache and queued changes are removed. Call right before clearing auth. */
export function markAccountDeleted(): void {
  setSessionEndIntent('deleted');
}
