'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCurrency } from '@/lib/currency/currency-provider';
import { centsToMajorString } from '@/lib/currency/format';
import { parseItemPriceInput, parseQuantityInput } from '@/lib/shopping/item-input';
import {
  MAX_ITEM_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  SHOPPING_CATEGORIES,
  SHOPPING_UNITS,
  isShoppingUnit,
  normalizeCategory,
  unitLabel,
} from '@/lib/shopping/vocab';
import type { ShoppingItem, UpdateShoppingItemInput } from '@/types/shopping.types';

interface ItemEditSheetProps {
  item: ShoppingItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemId: string, patch: UpdateShoppingItemInput) => void;
  onDelete: (item: ShoppingItem) => void;
}

interface FormErrors {
  name?: string;
  quantity?: string;
  estimate?: string;
  actual?: string;
}

const centsToField = (cents: number | null) => (cents === null ? '' : centsToMajorString(cents));

function EditForm({
  item,
  onClose,
  onSave,
  onDelete,
}: Omit<ItemEditSheetProps, 'item' | 'isOpen'> & { item: ShoppingItem }) {
  const { currency } = useCurrency();
  const [name, setName] = useState(item.itemName);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [category, setCategory] = useState(normalizeCategory(item.category));
  const [estimate, setEstimate] = useState(centsToField(item.costEstimateCents));
  const [actual, setActual] = useState(centsToField(item.actualCostCents));
  const [notes, setNotes] = useState(item.notes ?? '');
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const qty = parseQuantityInput(quantity);
    const est = parseItemPriceInput(estimate, currency);
    const act = parseItemPriceInput(actual, currency);

    const nextErrors: FormErrors = {
      name: trimmedName ? undefined : 'Enter a name.',
      quantity: qty.ok ? undefined : qty.message,
      estimate: est.ok ? undefined : est.message,
      actual: act.ok ? undefined : act.message,
    };
    setErrors(nextErrors);
    if (!qty.ok || !est.ok || !act.ok || !trimmedName) return;

    const trimmedNotes = notes.trim();
    const patch: UpdateShoppingItemInput = {
      ...(trimmedName !== item.itemName ? { itemName: trimmedName } : {}),
      ...(qty.quantity !== item.quantity ? { quantity: qty.quantity } : {}),
      ...(unit !== item.unit ? { unit } : {}),
      ...(category !== normalizeCategory(item.category) ? { category } : {}),
      ...(est.cents !== item.costEstimateCents ? { costEstimateCents: est.cents } : {}),
      ...(act.cents !== item.actualCostCents ? { actualCostCents: act.cents } : {}),
      ...((trimmedNotes || null) !== item.notes ? { notes: trimmedNotes || null } : {}),
    };

    if (Object.keys(patch).length > 0) onSave(item.id, patch);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={MAX_ITEM_NAME_LENGTH}
        error={errors.name}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Quantity"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          error={errors.quantity}
        />
        <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {!isShoppingUnit(unit) && <option value={unit}>{unitLabel(unit)}</option>}
          {SHOPPING_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </Select>
      </div>
      <Select
        label="Category"
        value={category}
        onChange={(e) => setCategory(normalizeCategory(e.target.value))}
      >
        {SHOPPING_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Estimated price"
          inputMode="decimal"
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          suffix={currency}
          error={errors.estimate}
        />
        <Input
          label="Actual price"
          inputMode="decimal"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          suffix={currency}
          error={errors.actual}
        />
      </div>
      <div>
        <label htmlFor="shopping-item-notes" className="mb-2 block text-sm font-semibold text-gray-900">
          Notes
        </label>
        <textarea
          id="shopping-item-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={MAX_NOTES_LENGTH}
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" className="w-full sm:w-auto">
          Save
        </Button>
        <Button
          type="button"
          variant="danger"
          className="w-full sm:w-auto"
          onClick={() => {
            onDelete(item);
            onClose();
          }}
        >
          Delete
        </Button>
      </div>
    </form>
  );
}

export function ItemEditSheet({ item, isOpen, onClose, onSave, onDelete }: ItemEditSheetProps) {
  return (
    <Modal isOpen={isOpen && item !== null} onClose={onClose} title="Edit item">
      {item && (
        <EditForm key={item.id} item={item} onClose={onClose} onSave={onSave} onDelete={onDelete} />
      )}
    </Modal>
  );
}
