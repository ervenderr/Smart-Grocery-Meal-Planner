import { getApiErrorCode } from '@/lib/api/errors';
import type { AiConsentStatus } from '@/lib/api/ai-consent';

export const AI_CONSENT_REQUIRED_CODE = 'AI_CONSENT_REQUIRED';

export type ConsentState = 'granted' | 'missing' | 'unknown';

export function toConsentState(
  status: AiConsentStatus | undefined,
  isLoading: boolean
): ConsentState {
  if (isLoading || !status) return 'unknown';
  return status.consented ? 'granted' : 'missing';
}

/** Never send data while the state is unknown. */
export function decideAiAction(state: ConsentState): 'run' | 'prompt' {
  return state === 'granted' ? 'run' : 'prompt';
}

export function isAiConsentRequiredError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const response = (error as { response?: { status?: unknown } }).response;
  return response?.status === 403 && getApiErrorCode(error) === AI_CONSENT_REQUIRED_CODE;
}
