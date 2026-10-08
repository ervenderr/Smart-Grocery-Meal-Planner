'use client';

import { useCurrency } from '@/lib/currency/currency-provider';
import { computeTotals } from '@/lib/shopping/totals';
import { describeDifference, type TripItem } from '@/lib/shopping/trip';
import { NOTHING_CHECKED_HINT, NOTHING_CHECKED_HINT_ID } from './finish-sheet';

interface SummaryBarProps {
  items: readonly TripItem[];
  onFinish: () => void;
  finishDisabled?: boolean;
}

export function SummaryBar({ items, onFinish, finishDisabled = false }: SummaryBarProps) {
  const { format } = useCurrency();
  const totals = computeTotals(items);
  const { tone, amountCents } = describeDifference(totals.differenceCents);
  const nothingChecked = !items.some((i) => i.isChecked);

  return (
    <div
      role="region"
      aria-label="Spend summary"
      className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-gray-200 bg-white p-3 shadow-soft lg:bottom-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 text-sm text-gray-600">
          <p>
            Estimated <span className="font-semibold text-gray-900">{format(totals.estimatedCents)}</span>
          </p>
          <p>
            Actual <span className="font-semibold text-gray-900">{format(totals.actualCents)}</span>{' '}
            ({totals.itemsWithActual} priced)
            {tone === 'under' && (
              <span className="font-semibold text-gray-900"> · Under by {format(amountCents)}</span>
            )}
            {tone === 'over' && (
              <span className="font-semibold text-gray-900"> · Over by {format(amountCents)}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onFinish}
          disabled={finishDisabled || nothingChecked}
          aria-describedby={nothingChecked ? NOTHING_CHECKED_HINT_ID : undefined}
          className="min-h-11 rounded-lg bg-primary-600 px-4 text-base font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Finish shopping
        </button>
      </div>
      {nothingChecked && (
        <p id={NOTHING_CHECKED_HINT_ID} className="mt-2 text-sm text-gray-600">
          {NOTHING_CHECKED_HINT}
        </p>
      )}
    </div>
  );
}
