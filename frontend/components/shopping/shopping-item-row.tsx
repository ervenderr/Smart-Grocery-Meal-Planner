'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { AislePriceInput } from '@/components/shopping/aisle-price-input';
import { useCurrency } from '@/lib/currency/currency-provider';
import { itemCheckboxLabel, priceChipLabel } from '@/lib/shopping/a11y';
import { unitLabel } from '@/lib/shopping/vocab';
import type { ShoppingItem } from '@/types/shopping.types';

interface ShoppingItemRowProps {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem) => void;
  onOpen: (item: ShoppingItem) => void;
  large?: boolean;
  onSetActualPrice?: (cents: number | null) => void;
}

export function ShoppingItemRow({
  item,
  onToggle,
  onOpen,
  large = false,
  onSetActualPrice,
}: ShoppingItemRowProps) {
  const { format } = useCurrency();
  const [pricing, setPricing] = useState(false);

  let priceText = '';
  if (item.actualCostCents !== null) {
    priceText = format(item.actualCostCents);
  } else if (item.costEstimateCents !== null) {
    priceText = `Est. ${format(item.costEstimateCents)}`;
  }
  const meta = [`${item.quantity} ${unitLabel(item.unit)}`, priceText].filter(Boolean).join(' · ');

  if (large) {
    const chipText = item.actualCostCents !== null ? format(item.actualCostCents) : 'Add price';
    // The chip already shows an actual price, so only the estimate is added here.
    const largeMeta = [
      `${item.quantity} ${unitLabel(item.unit)}`,
      item.actualCostCents === null && item.costEstimateCents !== null
        ? `Est. ${format(item.costEstimateCents)}`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <li
        data-shopping-mode="large"
        data-testid="shopping-row-large"
        className="min-h-14 border-b border-gray-100 last:border-b-0"
      >
        <div className="flex min-h-14 items-stretch">
          <button
            type="button"
            role="checkbox"
            aria-checked={item.isChecked}
            // Name comes from the visible text (item, quantity, estimate); aria-checked carries state.
            onClick={() => onToggle(item)}
            className="flex min-h-14 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded border-2 ${
                  item.isChecked
                    ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {item.isChecked && <Check className="h-5 w-5" aria-hidden="true" />}
              </span>
            </span>
            <span className="flex flex-col py-2">
              <span
                className={`text-base break-words ${
                  item.isChecked ? 'text-gray-500 line-through' : 'font-semibold text-gray-900'
                }`}
              >
                {item.itemName}
              </span>
              <span className="text-sm text-gray-600">{largeMeta}</span>
            </span>
          </button>
          {onSetActualPrice && (
            <button
              type="button"
              aria-label={priceChipLabel(chipText, item.itemName)}
              aria-expanded={pricing}
              onClick={() => setPricing((open) => !open)}
              className="min-h-11 min-w-11 self-center rounded-lg px-3 text-sm text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {chipText}
            </button>
          )}
        </div>
        {pricing && onSetActualPrice && (
          <AislePriceInput
            itemName={item.itemName}
            initialCents={item.actualCostCents}
            onSave={(cents) => {
              onSetActualPrice(cents);
              setPricing(false);
            }}
            onCancel={() => setPricing(false)}
          />
        )}
      </li>
    );
  }

  return (
    <li className="flex min-h-14 items-center gap-2 border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.isChecked}
        aria-label={itemCheckboxLabel(item.itemName)}
        onClick={() => onToggle(item)}
        className="flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded border-2 ${
            item.isChecked ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-300 bg-white'
          }`}
        >
          {item.isChecked && <Check className="h-4 w-4" aria-hidden="true" />}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-h-11 flex-1 flex-col items-start justify-center py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span
          className={`text-base break-words ${
            item.isChecked ? 'text-gray-500 line-through' : 'text-gray-900'
          }`}
        >
          {item.itemName}
        </span>
        <span className="text-sm text-gray-600">{meta}</span>
      </button>
    </li>
  );
}
