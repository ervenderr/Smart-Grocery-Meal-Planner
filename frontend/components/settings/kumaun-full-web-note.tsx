import { Info } from 'lucide-react';
import { ENTITLEMENT_COPY } from '@/lib/entitlements/copy';

/** Web has no purchase UI (Guideline 3.1.1): a plain note, no buttons, no links. */
export function KumaunFullWebNote() {
  return (
    <p
      data-testid="kumaun-full-web-note"
      className="flex items-start gap-2 text-sm text-gray-600"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{ENTITLEMENT_COPY.webNote}</span>
    </p>
  );
}
