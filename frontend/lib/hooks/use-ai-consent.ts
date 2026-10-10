'use client';

import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/react-query';
import { aiConsentApi, AI_CONSENT_QUERY_KEY, type AiConsentStatus } from '@/lib/api/ai-consent';
import { decideAiAction, toConsentState, type ConsentState } from '@/lib/ai/consent-flow';
import { useAiConsentStore } from '@/lib/ai/consent-store';

export function useAiConsent(): {
  status: ConsentState;
  consentedAt: string | null;
  runWithAiConsent: (action: () => void) => void;
} {
  const { data, isLoading } = useQuery({
    queryKey: AI_CONSENT_QUERY_KEY,
    queryFn: aiConsentApi.get,
    staleTime: 5 * 60_000,
  });
  const status = toConsentState(data, isLoading);

  const runWithAiConsent = useCallback(
    (action: () => void) => {
      if (decideAiAction(status) === 'run') {
        action();
      } else {
        useAiConsentStore.getState().request(action);
      }
    },
    [status]
  );

  return { status, consentedAt: data?.consentedAt ?? null, runWithAiConsent };
}

function storeResult(data: AiConsentStatus): void {
  queryClient.setQueryData(AI_CONSENT_QUERY_KEY, data);
}

export function useGrantAiConsent() {
  return useMutation({ mutationFn: aiConsentApi.grant, onSuccess: storeResult });
}

export function useWithdrawAiConsent() {
  return useMutation({ mutationFn: aiConsentApi.withdraw, onSuccess: storeResult });
}
