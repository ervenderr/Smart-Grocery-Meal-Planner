import { getApiErrorMessage } from '@/lib/api/errors';

export const RETRYABLE_ERROR_COPY =
  "We couldn't reach Kitcha. Check your connection and try again.";
export const NON_RETRYABLE_FALLBACK_COPY =
  "We couldn't save part of your setup. Please review your choices, or continue without saving.";

export interface OnboardingFailure {
  readonly retryable: boolean;
  readonly message: string;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null || !('status' in response)) {
    return undefined;
  }
  const status = (response as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

const RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 425, 429]);

/**
 * Retrying only helps for network failures, timeouts, rate limits and 5xx.
 * Other 4xx responses are validation/conflict errors that repeat identically.
 */
export function classifyOnboardingError(error: unknown): OnboardingFailure {
  const status = statusOf(error);
  if (status === undefined || status >= 500 || RETRYABLE_CLIENT_STATUSES.has(status)) {
    return { retryable: true, message: RETRYABLE_ERROR_COPY };
  }
  return {
    retryable: false,
    message: getApiErrorMessage(error, NON_RETRYABLE_FALLBACK_COPY),
  };
}

interface NamedItem {
  readonly ingredientName: string;
}

/**
 * Names from `pending` that already exist in `existing` (case-insensitive).
 * Used on retry to avoid duplicating an item whose create response was lost.
 */
export function findAlreadyCreated(
  pending: ReadonlyArray<string>,
  existing: ReadonlyArray<NamedItem>
): string[] {
  const have = new Set(existing.map((i) => i.ingredientName.trim().toLowerCase()));
  return pending.filter((name) => have.has(name.trim().toLowerCase()));
}
