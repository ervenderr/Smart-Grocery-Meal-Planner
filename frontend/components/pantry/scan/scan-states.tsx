import { AlertTriangle, CameraOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CameraTopBar } from './camera-view';

export function LookingUp({ barcode }: { barcode: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-gray-700">
      <Loader2 className="text-primary-500 h-8 w-8 animate-spin" aria-hidden="true" />
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

interface CameraProblemProps {
  title: string;
  body: string;
  extra?: string;
  onTypeInstead: () => void;
  onRetry?: () => void;
}

function CameraProblem({ title, body, extra, onTypeInstead, onRetry }: CameraProblemProps) {
  return (
    <div className="flex h-full flex-col bg-black">
      <CameraTopBar />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 text-center text-white">
        <CameraOff className="h-12 w-12 text-gray-300" aria-hidden="true" />
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-base text-gray-300">{body}</p>
        {extra && <p className="text-base text-gray-300">{extra}</p>}
        <div className="pb-safe w-full max-w-sm space-y-3">
          <Button fullWidth onClick={onTypeInstead}>
            Type the barcode
          </Button>
          {onRetry && (
            <Button variant="outline" fullWidth onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CameraDeniedCard({
  iosStandalone,
  onTypeInstead,
  onRetry,
}: {
  iosStandalone: boolean;
  onTypeInstead: () => void;
  onRetry: () => void;
}) {
  return (
    <CameraProblem
      title="Camera access is off"
      body="Allow camera access in your browser settings to scan, or type the barcode instead."
      extra={
        iosStandalone ? 'On iPhone: Settings > Safari > Camera, or Settings > Kitcha.' : undefined
      }
      onTypeInstead={onTypeInstead}
      onRetry={onRetry}
    />
  );
}

export function ScanUnsupportedCard({ onTypeInstead }: { onTypeInstead: () => void }) {
  return (
    <CameraProblem
      title="Scanning isn't available here"
      body="This device or browser can't use the camera. Type the barcode instead."
      onTypeInstead={onTypeInstead}
    />
  );
}
