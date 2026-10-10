'use client';

import { AiConsentSheet } from './ai-consent-sheet';
import { useAiConsentStore } from '@/lib/ai/consent-store';
import { useGrantAiConsent } from '@/lib/hooks/use-ai-consent';

/** Single mount point binding the consent store to the sheet. */
export function AiConsentHost() {
  const isOpen = useAiConsentStore((s) => s.isOpen);
  const dismiss = useAiConsentStore((s) => s.dismiss);
  const grant = useGrantAiConsent();

  const handleAccept = async () => {
    await grant.mutateAsync();
    const action = useAiConsentStore.getState().accept();
    action?.();
  };

  return <AiConsentSheet isOpen={isOpen} onAccept={handleAccept} onDecline={dismiss} />;
}
