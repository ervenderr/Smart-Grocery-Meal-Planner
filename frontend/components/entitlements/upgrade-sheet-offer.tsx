'use client';

import { AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ENTITLEMENT_COPY as C } from '@/lib/entitlements/copy';
import type { UpgradeSheetModel } from '@/lib/entitlements/view-model';

interface OfferProps {
  model: UpgradeSheetModel;
  onBuy: () => void;
  onRestore: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

function PriceBlock({ priceText }: { priceText: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-gray-600">{C.cardTitle}</p>
      {priceText ? (
        <p className="text-3xl leading-9 font-semibold tabular-nums text-gray-900">{priceText}</p>
      ) : (
        <div
          className="h-9 w-28 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none"
          role="status"
          aria-label={C.loadingPrice}
        />
      )}
    </div>
  );
}

function MessageRegion({ message }: { message: UpgradeSheetModel['message'] }) {
  const isError = message?.tone === 'error';
  return (
    <div role="status" aria-live="polite">
      {message && (
        <p
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            isError ? 'bg-red-50 text-red-800' : 'text-gray-700'
          }`}
        >
          {isError && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{message.text}</span>
        </p>
      )}
    </div>
  );
}

export function UpgradeSheetOffer({ model, onBuy, onRestore, onRetry, onDismiss }: OfferProps) {
  const noPrice = model.priceText === null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <p className="text-base text-gray-900">{model.leadText}</p>
        <ul className="flex flex-col gap-2">
          {C.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-base text-gray-900">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-gray-700" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
      <PriceBlock priceText={model.priceText} />
      <div className="flex flex-col gap-2">
        {model.showBuy && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            data-testid="upgrade-buy"
            loading={model.buyLoading}
            disabled={model.buyDisabled}
            aria-disabled={model.buyDisabled || undefined}
            aria-label={noPrice ? C.loadingPrice : undefined}
            onClick={onBuy}
          >
            {model.ctaLabel}
          </Button>
        )}
        <Button
          variant="secondary"
          size="md"
          fullWidth
          data-testid="upgrade-restore"
          disabled={model.secondaryDisabled}
          onClick={onRestore}
        >
          {C.restore}
        </Button>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          data-testid="upgrade-dismiss"
          disabled={model.secondaryDisabled}
          onClick={onDismiss}
        >
          {C.dismiss}
        </Button>
      </div>
      <MessageRegion message={model.message} />
      {model.showTryAgain && (
        <Button variant="ghost" size="md" fullWidth onClick={onRetry}>
          {C.tryAgain}
        </Button>
      )}
      <p className="text-center text-sm text-gray-600">{C.reassurance}</p>
    </div>
  );
}
