/**
 * AI error contract. Responses carry `code`, `message` and an `error` alias
 * (added by errorHandler) so existing frontend handlers keep working.
 */

import { AppError } from '../../middleware/errorHandler';

export const AI_ERROR_CODES = {
  UNAVAILABLE: 'AI_UNAVAILABLE',
  QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  RATE_LIMITED: 'AI_RATE_LIMITED',
  LOOKUP_UNAVAILABLE: 'LOOKUP_UNAVAILABLE',
  LOOKUP_THROTTLED: 'LOOKUP_THROTTLED',
  LOOKUP_NOT_FOUND: 'LOOKUP_NOT_FOUND',
} as const;

export const AI_UNAVAILABLE_MESSAGE = 'AI suggestions are unavailable right now, try again later.';

export function aiUnavailableError(): AppError {
  return new AppError(AI_UNAVAILABLE_MESSAGE, 503, true, { code: AI_ERROR_CODES.UNAVAILABLE });
}

export interface QuotaExceededInput {
  readonly scope: 'user' | 'global';
  readonly limit: number;
  readonly resetsAt: string;
}

export function aiQuotaExceededError(input: QuotaExceededInput): AppError {
  const { scope, limit, resetsAt } = input;
  const message =
    scope === 'user'
      ? `Daily AI limit reached (${limit}/${limit}). Resets at ${resetsAt} (UTC).`
      : `The shared daily AI limit has been reached. Resets at ${resetsAt} (UTC).`;
  return new AppError(message, 429, true, {
    code: AI_ERROR_CODES.QUOTA_EXCEEDED,
    details: { quota: { scope, limit, remaining: 0, resetsAt } },
  });
}
