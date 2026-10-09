import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LookingUp({ barcode }: { barcode: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-gray-700">
      <Loader2 className="h-8 w-8 animate-spin text-primary-500" aria-hidden="true" />
      <p className="text-base">Looking up {barcode}...</p>
    </div>
  );
}

interface NoticeCardProps {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
}

function NoticeCard({
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: NoticeCardProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-base">{body}</p>
          </div>
        </div>
      </div>
      <Button fullWidth onClick={onPrimary}>
        {primaryLabel}
      </Button>
      <Button variant="outline" fullWidth onClick={onSecondary}>
        {secondaryLabel}
      </Button>
    </div>
  );
}

interface ResultCardProps {
  barcode: string;
  onAddManually: () => void;
  onSecondary: () => void;
}

export function UnknownProductCard({ barcode, onAddManually, onSecondary }: ResultCardProps) {
  return (
    <NoticeCard
      title="We don't know this product yet"
      body={`Barcode ${barcode} isn't in Open Food Facts. You can still add it yourself and we'll remember the barcode.`}
      primaryLabel="Add manually"
      onPrimary={onAddManually}
      secondaryLabel="Scan again"
      onSecondary={onSecondary}
    />
  );
}

export function LookupFailedCard({ onAddManually, onSecondary }: ResultCardProps) {
  return (
    <NoticeCard
      title="Couldn't look up this product"
      body="Check your connection and try again, or add it manually. The barcode is saved either way."
      primaryLabel="Try again"
      onPrimary={onSecondary}
      secondaryLabel="Add manually"
      onSecondary={onAddManually}
    />
  );
}
