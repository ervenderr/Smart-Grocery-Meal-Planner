import { apiClient } from './client';

export interface AiConsentStatus {
  consented: boolean;
  consentedAt: string | null;
  version: number | null;
  currentVersion: number;
}

export const AI_CONSENT_QUERY_KEY = ['ai-consent'] as const;

const ENDPOINT = '/api/v1/users/me/ai-consent';

export const aiConsentApi = {
  get: (): Promise<AiConsentStatus> => apiClient.get<AiConsentStatus>(ENDPOINT),
  grant: (): Promise<AiConsentStatus> => apiClient.post<AiConsentStatus>(ENDPOINT),
  withdraw: (): Promise<AiConsentStatus> => apiClient.delete<AiConsentStatus>(ENDPOINT),
};
