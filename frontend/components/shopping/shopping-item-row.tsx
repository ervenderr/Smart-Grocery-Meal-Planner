'use client';

import { Check } from 'lucide-react';
import { useCurrency } from '@/lib/currency/currency-provider';
import { unitLabel } from '@/lib/shopping/vocab';
import type { ShoppingItem } from '@/types/shopping.types';

interface ShoppingItemRowProps {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem) => void;
  onOpen: (item: ShoppingItem) => void;
}

export function ShoppingItemRow({ item, onToggle, onOpen }: ShoppingItemRowProps) {
  const { format } = useCurrency();

  let priceText = '';
  if (item.actualCostCents !== null) {
    priceText = format(item.actualCostCents);
  } else if (item.costEstimateCents !== null) {
    priceText = `Est. ${format(item.costEstimateCents)}`;
  }
  const meta = [`${item.quantity} ${unitLabel(item.unit)}`, priceText].filter(Boolean).join(' · ');

  return (
    <li className="flex min-h-14 items-center gap-2 border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.isChecked}
        aria-label={
          item.isChecked ? `Mark ${item.itemName} as not bought` : `Mark ${item.itemName} as bought`
        }
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
