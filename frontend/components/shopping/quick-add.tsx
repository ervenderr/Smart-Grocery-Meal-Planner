'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { nameAfterAddSuccess, parseQuantityInput } from '@/lib/shopping/item-input';
import {
  DEFAULT_UNIT,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEMS_PER_LIST,
  SHOPPING_CATEGORIES,
  SHOPPING_UNITS,
} from '@/lib/shopping/vocab';
import type { CreateShoppingItemInput } from '@/types/shopping.types';

export const QUICK_ADD_INPUT_ID = 'shopping-quick-add';

export interface QuickAddCallbacks {
  readonly onSuccess: () => void;
  readonly onSettled: () => void;
}

interface QuickAddProps {
  /** Must invoke onSuccess when the item was saved, so a failed add keeps the typed name. */
  onAdd: (input: CreateShoppingItemInput, callbacks: QuickAddCallbacks) => void;
  disabled?: boolean;
  isFull?: boolean;
}

export function QuickAdd({ onAdd, disabled = false, isFull = false }: QuickAddProps) {
  const [name, setName] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<string>(DEFAULT_UNIT);
  const [category, setCategory] = useState('');
  const [quantityError, setQuantityError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const isDisabled = disabled || isFull;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isDisabled || inFlight.current) return;

    const parsed = parseQuantityInput(quantity);
    if (!parsed.ok) {
      setQuantityError(parsed.message);
      setShowOptions(true);
      return;
    }
    setQuantityError(undefined);

    inFlight.current = true;
    setPending(true);
    onAdd(
      {
        itemName: trimmed,
        quantity: parsed.quantity,
        unit,
        ...(category ? { category } : {}),
      },
      {
        onSuccess: () => setName((current) => nameAfterAddSuccess(current, trimmed)),
        onSettled: () => {
          inFlight.current = false;
          setPending(false);
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2" aria-label="Add an item">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            id={QUICK_ADD_INPUT_ID}
            label="Add an item"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_ITEM_NAME_LENGTH}
            enterKeyHint="done"
            autoComplete="off"
            placeholder="e.g. Eggs"
            disabled={isDisabled}
          />
        </div>
        <Button type="submit" disabled={isDisabled || pending || name.trim() === ''}>
          Add
        </Button>
      </div>

      {isFull && (
        <p role="status" className="text-sm text-gray-600">
          This list has the maximum of {MAX_ITEMS_PER_LIST} items.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowOptions((v) => !v)}
        aria-expanded={showOptions}
        aria-controls="shopping-quick-add-options"
        className="flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-600"
      >
        More options
        <ChevronDown
          className={`h-4 w-4 transition-transform ${showOptions ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {showOptions && (
        <div id="shopping-quick-add-options" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Input
            id="shopping-quick-add-quantity"
            label="Quantity"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
            error={quantityError}
            disabled={isDisabled}
          />
          <Select
            id="shopping-quick-add-unit"
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={isDisabled}
          >
            {SHOPPING_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
          <Select
            id="shopping-quick-add-category"
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isDisabled}
          >
            <option value="">Auto</option>
            {SHOPPING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      )}
    </form>
  );
}
