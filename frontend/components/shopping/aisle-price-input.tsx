'use client';

import { useState } from 'react';
import { useCurrency } from '@/lib/currency/currency-provider';
import { centsToMajorString } from '@/lib/currency/format';
import { parseItemPriceInput } from '@/lib/shopping/item-input';

interface AislePriceInputProps {
  itemName: string;
  initialCents: number | null;
  onSave: (cents: number | null) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function AislePriceInput({
  itemName,
  initialCents,
  onSave,
  onCancel,
  isSaving = false,
}: AislePriceInputProps) {
  const { currency } = useCurrency();
  const [value, setValue] = useState(initialCents === null ? '' : centsToMajorString(initialCents));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = parseItemPriceInput(value, currency);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setError(null);
    onSave(parsed.cents);
  };

  return (
    <div className="pb-3 pl-2 pr-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={value}
          aria-label={`Actual price for ${itemName}`}
          aria-invalid={error !== null}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-base text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
        <span className="text-sm text-gray-600">{currency}</span>
        <button
          type="button"
          onClick={submit}
          disabled={isSaving}
          className="min-h-11 min-w-11 rounded-lg bg-primary-500 px-3 text-base font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 min-w-11 rounded-lg px-3 text-base text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
