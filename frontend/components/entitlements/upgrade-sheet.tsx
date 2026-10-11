'use client';

import { Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ENTITLEMENT_COPY as C } from '@/lib/entitlements/copy';
import type { UpgradeSheetModel } from '@/lib/entitlements/view-model';
import { UpgradeSheetOffer } from './upgrade-sheet-offer';

export interface UpgradeSheetProps {
  open: boolean;
  model: UpgradeSheetModel;
  onClose: () => void;
  onContinue: () => void;
  onBuy: () => void;
  onRestore: () => void;
  onRetry: () => void;
}

/** Presentational upgrade sheet (UI-SPEC Surface 2). State lives in the host. */
export function UpgradeSheet(props: UpgradeSheetProps) {
  const { open, model, onClose, onContinue } = props;
  const success = model.state === 'success';
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={success ? C.successTitle : C.ctaCard}
      size="sm"
    >
      <div data-testid="upgrade-sheet">
        {success ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-2" role="status" aria-live="polite">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-gray-700" aria-hidden="true" />
              <p className="text-base text-gray-900">{C.successBody}</p>
            </div>
            <Button variant="primary" size="lg" fullWidth onClick={onContinue}>
              {C.successCta}
            </Button>
          </div>
        ) : (
          <UpgradeSheetOffer
            model={model}
            onBuy={props.onBuy}
            onRestore={props.onRestore}
            onRetry={props.onRetry}
            onDismiss={onClose}
          />
        )}
      </div>
    </Modal>
  );
}
