'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { useAiConsent, useWithdrawAiConsent } from '@/lib/hooks/use-ai-consent';
import { useAiConsentStore } from '@/lib/ai/consent-store';
import { formatConsentCaption } from '@/lib/settings/consent-caption';
import { LEGAL_ROUTES } from '@/lib/legal/legal-config';

const LABEL_ID = 'ai-features-label';
const DESC_ID = 'ai-features-desc';

export function AiPrivacySettings() {
  const { status, consentedAt } = useAiConsent();
  const withdraw = useWithdrawAiConsent();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const caption = status === 'granted' ? formatConsentCaption(consentedAt) : null;

  const handleToggle = (next: boolean) => {
    if (next) {
      // The switch only flips once the query data changes after acceptance.
      useAiConsentStore.getState().request();
      return;
    }
    withdraw.reset();
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (withdraw.isPending) return;
    setConfirmOpen(false);
  };

  const confirmWithdraw = () => {
    withdraw.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
  };

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-gray-900">AI and privacy</h2>
      <div className="mt-4 flex items-center justify-between gap-4">
        <span id={LABEL_ID} className="text-base font-medium text-gray-900">
          AI features
        </span>
        <Switch
          checked={status === 'granted'}
          onCheckedChange={handleToggle}
          labelledBy={LABEL_ID}
          describedBy={DESC_ID}
          disabled={status === 'unknown' || withdraw.isPending}
        />
      </div>
      {caption && <p className="text-sm text-gray-600">{caption}</p>}
      <p id={DESC_ID} className="mt-2 text-sm text-gray-600">
        Kumaun only sends pantry item names, diet tags and plan settings to an AI provider when
        you use AI features.
      </p>
      <a
        href={LEGAL_ROUTES.privacy}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary-700 underline"
      >
        Privacy Policy
      </a>

      <Modal isOpen={confirmOpen} onClose={closeConfirm} title="Turn off AI features?" size="sm">
        <p className="text-sm text-gray-700">Kumaun will stop sending data to AI providers.</p>
        {withdraw.isError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            Couldn&apos;t save your choice. Check your connection and try again.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <Button variant="primary" loading={withdraw.isPending} onClick={confirmWithdraw}>
            Turn off
          </Button>
          <Button variant="secondary" onClick={closeConfirm} disabled={withdraw.isPending}>
            Keep on
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
