'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';

export const BARCODE_PATTERN = /^\d{8,14}$/;
export const BARCODE_ERROR = 'Barcode must be 8 to 14 digits.';
const BARCODE_MAX_LENGTH = 14;

interface BarcodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  /** Trailing control (e.g. the scan icon button). */
  trailing?: ReactNode;
  /** When true, the field hides behind an "Add barcode" button until used. */
  collapsible?: boolean;
}

export function BarcodeField({
  value,
  onChange,
  error,
  disabled,
  trailing,
  collapsible = false,
}: BarcodeFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const isHidden = collapsible && !expanded && value.length === 0;

  if (isHidden) {
    return (
      <button
        type="button"
        className="min-h-11 text-sm text-primary-700 underline"
        disabled={disabled}
        onClick={() => setExpanded(true)}
      >
        Add barcode
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label="Barcode"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={BARCODE_MAX_LENGTH}
            placeholder="e.g., 5000159484695"
            value={value}
            disabled={disabled}
            error={error}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        {trailing}
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Optional. Used to fill details when you scan this again.
      </p>
    </div>
  );
}
