'use client';

import { useState } from 'react';
import { Edit2, Trash2, MapPin, Calendar, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ExpirySheet } from '@/components/pantry/expiry-sheet';
import { QuantityStepper } from '@/components/pantry/quantity-stepper';
import { UsedUpBadge } from '@/components/pantry/used-up-badge';
import { useDebouncedQuantity } from '@/lib/hooks/use-debounced-quantity';
import type { PantryQuickPatch } from '@/lib/hooks/use-pantry';
import { formatExpiryDate, getExpiryBadge } from '@/lib/pantry/expiry';
import { stepForUnit } from '@/lib/pantry/quantity';
import type { PantryItem } from '@/types/pantry.types';

interface PantryItemCardProps {
  item: PantryItem;
  onEdit: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
  onPatch: (item: PantryItem, patch: PantryQuickPatch) => Promise<void>;
  onRemoveUsedUp: (item: PantryItem) => void;
}

export function PantryItemCard({
  item,
  onEdit,
  onDelete,
  onPatch,
  onRemoveUsedUp,
}: PantryItemCardProps) {
  const { value: quantity, change } = useDebouncedQuantity(Number(item.quantity), (next) =>
    onPatch(item, { quantity: next })
  );
  const [expiryOpen, setExpiryOpen] = useState(false);
  const usedUp = Number(item.quantity) === 0 && quantity === 0;
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      protein: 'bg-red-100 text-red-800',
      vegetable: 'bg-green-100 text-green-800',
      fruit: 'bg-pink-100 text-pink-800',
      dairy: 'bg-blue-100 text-blue-800',
      grains: 'bg-amber-100 text-amber-800',
      spices: 'bg-orange-100 text-orange-800',
      canned: 'bg-gray-100 text-gray-800',
      frozen: 'bg-cyan-100 text-cyan-800',
      beverages: 'bg-purple-100 text-purple-800',
      condiments: 'bg-yellow-100 text-yellow-800',
      other: 'bg-slate-100 text-slate-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const expiryStatus = usedUp ? null : getExpiryBadge(item.expiryDate);
  const expiryDateLabel = formatExpiryDate(item.expiryDate);

  return (
    <Card className={`p-3 sm:p-4 hover:shadow-md transition-shadow ${usedUp ? 'bg-gray-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Item Name & Category */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{item.ingredientName}</h3>
            <span className={`rounded-full px-2 py-0.5 text-sm font-semibold w-fit ${getCategoryColor(item.category)}`}>
              {item.category}
            </span>
            {usedUp && <UsedUpBadge />}
          </div>

          {/* Quantity */}
          <div className="mt-2">
            <QuantityStepper
              value={quantity}
              unitLabel={item.unit}
              step={stepForUnit(item.unit)}
              label={item.ingredientName}
              onChange={change}
            />
          </div>

          {usedUp && (
            <button
              type="button"
              onClick={() => onRemoveUsedUp(item)}
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-red-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove from pantry
            </button>
          )}

          {/* Location */}
          {item.location && (
            <div className="mt-2 flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-3 w-3" />
              {item.location}
            </div>
          )}

          {/* Expiry chip: always a button that opens the expiry sheet */}
          <div className="mt-2">
            {item.expiryDate ? (
              <button
                type="button"
                onClick={() => setExpiryOpen(true)}
                aria-label={`Change expiry date for ${item.ingredientName}, currently ${expiryDateLabel}`}
                className={`inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold ${
                  expiryStatus ? expiryStatus.color : 'text-gray-600'
                }`}
              >
                {expiryStatus ? (
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                )}
                {expiryStatus ? expiryStatus.label : `Expires: ${expiryDateLabel}`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setExpiryOpen(true)}
                aria-label={`Add expiry date for ${item.ingredientName}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 text-sm font-semibold text-gray-600"
              >
                <Calendar className="h-3 w-3" aria-hidden="true" />
                Add expiry date
              </button>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <p className="mt-2 text-sm text-gray-500 line-clamp-2 break-words">{item.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            title="Edit item"
            aria-label={`Edit ${item.ingredientName}`}
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
            title="Delete item"
            aria-label={`Delete ${item.ingredientName}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ExpirySheet
        isOpen={expiryOpen}
        onClose={() => setExpiryOpen(false)}
        itemName={item.ingredientName}
        currentDate={item.expiryDate ? item.expiryDate.slice(0, 10) : null}
        onSave={(expiryDate) => onPatch(item, { expiryDate })}
      />
    </Card>
  );
}
