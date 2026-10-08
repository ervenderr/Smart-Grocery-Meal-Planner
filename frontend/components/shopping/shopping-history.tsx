'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/errors';
import { useCurrency } from '@/lib/currency/currency-provider';
import { useShoppingHistory } from '@/lib/hooks/use-finish-shopping';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

/** Parse YYYY-MM-DD as a local date (new Date(str) would be UTC and can shift a day). */
function formatReceiptDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return DATE_FORMAT.format(new Date(y, m - 1, d));
}

export function ShoppingHistory() {
  const { format } = useCurrency();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useShoppingHistory(page, expanded);
  const contentId = 'shopping-history-content';
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between px-4 text-base font-semibold text-gray-900"
        >
          Past trips
          <ChevronDown
            className={`h-5 w-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h2>
      {expanded && (
        <div id={contentId} className="border-t border-gray-200 px-4 py-2">
          {isLoading && <p className="py-2 text-sm text-gray-600">Loading past trips...</p>}
          {isError && (
            <div className="py-2">
              <p role="alert" className="text-sm text-gray-900">
                {getApiErrorMessage(error, "Couldn't load past trips.")}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="min-h-11 text-base font-semibold text-primary-600"
              >
                Try again
              </button>
            </div>
          )}
          {data && data.items.length === 0 && (
            <p className="py-2 text-sm text-gray-600">No finished trips yet.</p>
          )}
          {data && data.items.length > 0 && (
            <>
              <ul className="divide-y divide-gray-100">
                {data.items.map((trip) => (
                  <li key={trip.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-gray-900">
                        {formatReceiptDate(trip.receiptDate)}
                      </p>
                      <p className="text-sm text-gray-600">
                        est. {format(trip.estimatedCents)} · {trip.itemCount}{' '}
                        {trip.itemCount === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                    <p className="text-base font-semibold text-gray-900">{format(trip.totalCents)}</p>
                  </li>
                ))}
              </ul>
              {totalPages > 1 && (
                <div className="flex items-center justify-between py-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="min-h-11 px-3 text-base font-semibold text-primary-600 disabled:text-gray-400"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="min-h-11 px-3 text-base font-semibold text-primary-600 disabled:text-gray-400"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
