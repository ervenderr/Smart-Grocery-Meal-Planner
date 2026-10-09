'use client';

import { useCurrency } from '@/lib/currency/currency-provider';
import { computeTotals } from '@/lib/shopping/totals';
import { describeDifference, differenceLabel, type TripItem } from '@/lib/shopping/trip';
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
  const diffText = differenceLabel(tone, format(amountCents));
  const nothingChecked = !items.some((i) => i.isChecked);

  // Sticky offsets are measured from the CONTENT box of the scrolling <main>
  // (see app/(app)/layout.tsx), which already reserves bottom padding for the
  // fixed bottom nav (5rem + safe area below lg, 2rem at lg). A negative
  // offset/margin equal to the padding minus the nav height (1rem; 2rem at lg)
  // lands the bar flush on the nav, both while stuck and at the end of the
  // list. Keep these in sync with the <main> padding.
  return (
    <div
      role="region"
      aria-label="Spend summary"
      className="shadow-soft sticky -bottom-4 z-10 -mb-4 border-t border-gray-200 bg-white p-3 lg:-bottom-8 lg:-mb-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <dl className="grid w-full min-w-0 grid-cols-[1fr_auto] gap-x-4 text-sm text-gray-600 sm:w-auto sm:flex-1">
          <dt>Estimated (all items)</dt>
          <dd className="text-right font-semibold text-gray-900">
            {format(totals.estimatedCents)}
          </dd>
          {totals.itemsWithActual > 0 && (
            <>
              <dt>Estimated for priced items</dt>
              <dd className="text-right font-semibold text-gray-900">
                {format(totals.estimatedForPricedCents)}
              </dd>
            </>
          )}
          <dt>Actual ({totals.itemsWithActual} priced)</dt>
          <dd className="text-right font-semibold text-gray-900">{format(totals.actualCents)}</dd>
        </dl>
        <button
          type="button"
          onClick={onFinish}
          disabled={finishDisabled || nothingChecked}
          aria-describedby={nothingChecked ? NOTHING_CHECKED_HINT_ID : undefined}
          className="bg-primary-600 hover:bg-primary-700 min-h-11 rounded-lg px-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Finish shopping
        </button>
      </div>
      {diffText && <p className="mt-1 text-sm font-semibold text-gray-900">{diffText}</p>}
      {nothingChecked && (
        <p id={NOTHING_CHECKED_HINT_ID} className="mt-2 text-sm text-gray-600">
          {NOTHING_CHECKED_HINT}
        </p>
      )}
    </div>
  );
}
