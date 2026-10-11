'use client';

import { AlertTriangle, Check, Info, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ENTITLEMENT_COPY as C } from '@/lib/entitlements/copy';
import { buildCardModel, type CardModel } from '@/lib/entitlements/view-model';
import { useEntitlement } from '@/lib/hooks/use-entitlement';
import { usePlatform } from '@/lib/platform/use-platform';
import { KumaunFullWebNote } from './kumaun-full-web-note';

function StatusChip({ chip, text }: { chip: CardModel['chip']; text: string }) {
  if (chip === 'loading') {
    return (
      <span
        data-testid="kumaun-full-status"
        aria-label="Loading status"
        className="h-6 w-24 animate-pulse rounded-full bg-gray-200 motion-reduce:animate-none"
      />
    );
  }
  const unlocked = chip === 'unlocked';
  return (
    <span
      data-testid="kumaun-full-status"
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
        unlocked ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {unlocked && <Check className="h-4 w-4" aria-hidden="true" />}
      {text}
    </span>
  );
}

function MessageRegion({ message }: { message: CardModel['message'] }) {
  const isError = message?.tone === 'error';
  return (
    <div role="status" aria-live="polite" data-testid="kumaun-full-message">
      {message && (
        <p
          className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
            isError ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'
          }`}
        >
          {isError ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{message.text}</span>
        </p>
      )}
    </div>
  );
}

function NativeCard() {
  const ent = useEntitlement();
  const model = buildCardModel({
    native: true,
    me: ent.me,
    meLoading: ent.meLoading,
    product: ent.product,
    productError: ent.productError,
    flow: ent.flow,
    message: ent.message,
  });
  const loadingPrice = !ent.product && !ent.productError;

  return (
    <Card data-testid="kumaun-full-card" className="space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-gray-700" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-gray-900">{C.cardTitle}</h2>
        <div className="ml-auto">
          <StatusChip chip={model.chip} text={model.chipText} />
        </div>
      </div>
      <p className="text-base text-gray-700">{model.description}</p>
      {model.price && (
        <div>
          <p className="text-3xl font-semibold leading-9 tabular-nums text-gray-900">
            {model.price}
          </p>
          <p className="text-sm text-gray-600">{C.oneTime}</p>
        </div>
      )}
      <div className="flex flex-col gap-2 pt-1">
        {model.showBuy && (
          <Button
            data-testid="kumaun-full-buy"
            size="lg"
            fullWidth
            loading={ent.flow === 'purchasing'}
            aria-disabled={model.buyDisabled || undefined}
            disabled={model.buyDisabled && ent.flow !== 'purchasing'}
            onClick={() => void ent.purchase()}
          >
            {loadingPrice ? C.loadingPrice : C.ctaCard}
          </Button>
        )}
        <Button
          data-testid="kumaun-full-restore"
          variant={model.restoreVariant}
          size="md"
          fullWidth
          loading={ent.flow === 'restoring'}
          disabled={ent.flow === 'purchasing'}
          onClick={() => void ent.restore()}
        >
          {C.restore}
        </Button>
        {model.showTryAgain && (
          <Button variant="ghost" size="md" fullWidth onClick={ent.retryProduct}>
            {C.tryAgain}
          </Button>
        )}
      </div>
      <MessageRegion message={model.message} />
    </Card>
  );
}

export function KumaunFullCard() {
  const { native } = usePlatform();
  return native ? <NativeCard /> : <KumaunFullWebNote />;
}
