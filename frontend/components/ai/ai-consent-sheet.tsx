'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  AI_DATA_NOT_SENT,
  AI_DATA_SENT,
  AI_PROVIDER_LABEL,
  LEGAL_ROUTES,
} from '@/lib/legal/legal-config';

interface AiConsentSheetProps {
  isOpen: boolean;
  onAccept: () => Promise<void>;
  onDecline: () => void;
}

export function AiConsentSheet({ isOpen, onAccept, onDecline }: AiConsentSheetProps) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleAccept = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await onAccept();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = () => {
    setFailed(false);
    onDecline();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleDecline} title="Use AI features?" size="sm">
      <div className="space-y-4 text-base text-gray-700">
        <div>
          <p className="font-semibold text-gray-900">What is sent:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {AI_DATA_SENT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <p>
          <span className="font-semibold text-gray-900">Not sent: </span>
          {AI_DATA_NOT_SENT}
        </p>
        <p>
          <span className="font-semibold text-gray-900">Who receives it: </span>
          A third-party AI provider ({AI_PROVIDER_LABEL}) that processes it to generate
          suggestions.
        </p>
        <p>You can withdraw anytime in Settings.</p>
        <a
          href={LEGAL_ROUTES.privacy}
          target="_blank"
          rel="noopener"
          className="inline-block text-primary-700 underline"
        >
          Read the Privacy Policy
        </a>

        {failed && (
          <p role="alert" className="text-sm text-red-700">
            Couldn&apos;t save your choice. Check your connection and try again.
          </p>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button variant="primary" fullWidth loading={saving} onClick={handleAccept} autoFocus>
            Accept and continue
          </Button>
          <Button variant="secondary" fullWidth onClick={handleDecline} disabled={saving}>
            Not now
          </Button>
        </div>
      </div>
    </Modal>
  );
}
