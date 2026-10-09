'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { addDaysShortcut } from '@/lib/pantry/expiry';

const SHORTCUTS = [
  { days: 1, label: '+1 day' },
  { days: 3, label: '+3 days' },
  { days: 7, label: '+7 days' },
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SELECTED_CLASSES = 'bg-primary-50 border-primary-500 text-primary-700';

interface ExpirySheetProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  /** Current expiry as YYYY-MM-DD, or null when none is set. */
  currentDate: string | null;
  /** Resolves on success, rejects after the optimistic rollback. */
  onSave: (expiryDate: string | null) => Promise<void>;
}

function isValidIso(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return (
    check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d
  );
}

export function ExpirySheet({ isOpen, onClose, itemName, currentDate, onSave }: ExpirySheetProps) {
  const [value, setValue] = useState(currentDate ?? '');
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(currentDate ?? '');
      setSelected(null);
      setError(null);
    }
  }, [isOpen, currentDate]);

  const persist = async (next: string | null, successMessage: string) => {
    setSaving(true);
    try {
      await onSave(next);
      toast.success(successMessage);
      onClose();
    } catch {
      toast.error("Couldn't update the expiry date. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!isValidIso(value)) {
      setError('Pick a valid date, or use Clear date.');
      return;
    }
    setError(null);
    void persist(value, 'Expiry date updated.');
  };

  const handleShortcut = (days: number) => {
    setValue((current) => addDaysShortcut(current, days));
    setSelected(days);
    setError(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Expiry date" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{itemName}</p>

        <div className="space-y-2">
          <label htmlFor="expiry-sheet-date" className="text-sm font-semibold text-gray-900">
            Expires on
          </label>
          <input
            id="expiry-sheet-date"
            type="date"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSelected(null);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'expiry-sheet-error' : undefined}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
          />
          {error && (
            <p id="expiry-sheet-error" role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">Add days to the date above</p>
          <div role="group" aria-label="Quick expiry shortcuts" className="grid grid-cols-3 gap-2">
            {SHORTCUTS.map(({ days, label }) => (
              <button
                key={days}
                type="button"
                onClick={() => handleShortcut(days)}
                className={`h-11 rounded-lg border px-4 text-sm font-semibold ${
                  selected === days ? SELECTED_CLASSES : 'border-gray-300 text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600">
            Adds days to the date in the field, or to today if it is empty or already past.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {currentDate && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void persist(null, 'Expiry date cleared.')}
            >
              Clear date
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Keep current date
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            Save date
          </Button>
        </div>
      </div>
    </Modal>
  );
}
