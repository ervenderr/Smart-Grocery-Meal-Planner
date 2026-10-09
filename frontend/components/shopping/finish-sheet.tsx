'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { pantryToggleHelper } from '@/lib/shopping/finish-toast';
import { useCurrency } from '@/lib/currency/currency-provider';
import { computeTripTotal, type TripItem } from '@/lib/shopping/trip';
import type { CarryOverMode } from '@/types/shopping.types';

export const NOTHING_CHECKED_HINT = 'Check off at least one item to finish this trip.';
export const NOTHING_CHECKED_HINT_ID = 'finish-nothing-checked-hint';
const PANTRY_LABEL_ID = 'finish-pantry-label';
const PANTRY_SWITCH_ID = 'finish-pantry-switch';
const PANTRY_HELPER_ID = 'finish-pantry-helper';

interface FinishSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: readonly TripItem[];
  onConfirm: (input: { carryOver: CarryOverMode; addToPantry: boolean }) => void;
  isPending: boolean;
}

const OPTIONS: ReadonlyArray<{ value: CarryOverMode; label: string }> = [
  { value: 'carry', label: 'Keep unchecked items on a new list' },
  { value: 'discard', label: 'Remove unchecked items' },
];

export function FinishSheet({ isOpen, onClose, items, onConfirm, isPending }: FinishSheetProps) {
  const { format } = useCurrency();
  const [carryOver, setCarryOver] = useState<CarryOverMode>('carry');
  const { totalCents, checkedCount, uncheckedCount } = computeTripTotal(items);
  const nothingChecked = checkedCount === 0;
  const [addToPantry, setAddToPantry] = useState(true);
  const pantryOn = addToPantry && !nothingChecked;

  // The toggle is ON by default every time the sheet opens.
  useEffect(() => {
    if (isOpen) setAddToPantry(true);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Finish shopping">
      <div className="space-y-4">
        <div>
          <p className="text-base font-semibold text-gray-900">
            Total of checked items: {format(totalCents)}
          </p>
          <p className="text-sm text-gray-600">
            {checkedCount} checked, {uncheckedCount} not checked
          </p>
        </div>

        {uncheckedCount > 0 && (
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-semibold text-gray-700">
              What about the unchecked items?
            </legend>
            {OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-base text-gray-900"
              >
                <input
                  type="radio"
                  name="carry-over"
                  value={option.value}
                  checked={carryOver === option.value}
                  onChange={() => setCarryOver(option.value)}
                  className="h-5 w-5 accent-primary-600"
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        )}

        <label
          htmlFor={PANTRY_SWITCH_ID}
          className={`flex min-h-14 items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2 ${
            nothingChecked || isPending ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <div>
            <span id={PANTRY_LABEL_ID} className="block text-base font-semibold text-gray-900">
              Add checked items to pantry
            </span>
            <p id={PANTRY_HELPER_ID} className="text-sm text-gray-600">
              {pantryToggleHelper(checkedCount, pantryOn)}
            </p>
          </div>
          <Switch
            id={PANTRY_SWITCH_ID}
            checked={pantryOn}
            onCheckedChange={setAddToPantry}
            disabled={nothingChecked || isPending}
            labelledBy={PANTRY_LABEL_ID}
            describedBy={PANTRY_HELPER_ID}
          />
        </label>

        {nothingChecked && (
          <p id={NOTHING_CHECKED_HINT_ID} className="text-sm text-gray-600">
            {NOTHING_CHECKED_HINT}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-gray-300 px-4 text-base font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({ carryOver: uncheckedCount > 0 ? carryOver : 'carry', addToPantry: pantryOn })
            }
            disabled={isPending || checkedCount === 0}
            aria-describedby={nothingChecked ? NOTHING_CHECKED_HINT_ID : undefined}
            className="min-h-11 rounded-lg bg-primary-600 px-4 text-base font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Finishing...' : 'Finish shopping'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
