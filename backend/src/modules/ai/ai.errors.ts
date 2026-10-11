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
  CONSENT_REQUIRED: 'AI_CONSENT_REQUIRED',
} as const;

export const AI_CONSENT_REQUIRED_MESSAGE = 'AI features are turned off. Accept to continue.';

export function aiConsentRequiredError(): AppError {
  return new AppError(AI_CONSENT_REQUIRED_MESSAGE, 403, true, {
    code: AI_ERROR_CODES.CONSENT_REQUIRED,
  });
}

export const AI_UNAVAILABLE_MESSAGE = 'AI suggestions are unavailable right now, try again later.';

export function aiUnavailableError(): AppError {
  return new AppError(AI_UNAVAILABLE_MESSAGE, 503, true, { code: AI_ERROR_CODES.UNAVAILABLE });
}

export interface QuotaExceededInput {
  readonly scope: 'user' | 'global' | 'user_month';
  readonly limit: number;
  readonly resetsAt: string;
}

function quotaMessage(scope: QuotaExceededInput['scope'], limit: number, resetsAt: string): string {
  if (scope === 'user') return `Daily AI limit reached (${limit}/${limit}). Resets at ${resetsAt} (UTC).`;
  if (scope === 'user_month') {
    return `Monthly AI limit reached (${limit}/${limit}). Resets at ${resetsAt} (UTC).`;
  }
  return `The shared daily AI limit has been reached. Resets at ${resetsAt} (UTC).`;
}

export function aiQuotaExceededError(input: QuotaExceededInput): AppError {
  const { scope, limit, resetsAt } = input;
  const message = quotaMessage(scope, limit, resetsAt);
  return new AppError(message, 429, true, {
    code: AI_ERROR_CODES.QUOTA_EXCEEDED,
    details: { quota: { scope, limit, remaining: 0, resetsAt } },
  });
}
