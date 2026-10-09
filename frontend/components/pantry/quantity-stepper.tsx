'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  MAX_QUANTITY,
  clampQuantity,
  formatQuantity,
  parseQuantityInput,
} from '@/lib/pantry/quantity';

interface QuantityStepperProps {
  value: number;
  unitLabel: string;
  step: number;
  min?: number;
  max?: number;
  /** Item name, used in aria-labels. */
  label: string;
  onChange: (next: number) => void;
  disabled?: boolean;
  /** Set false when the caller already announces the value, to avoid duplicate text. */
  announce?: boolean;
}

const BUTTON_CLASS =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed';

const FLASH_MS = 150;

export function QuantityStepper({
  value,
  unitLabel,
  step,
  min = 0,
  max = MAX_QUANTITY,
  label,
  onChange,
  disabled = false,
  announce = true,
}: QuantityStepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), FLASH_MS);
    return () => clearTimeout(id);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const bounded = (n: number) => Math.min(max, Math.max(min, clampQuantity(n)));
  const atMin = value <= min;
  const atMax = value >= max;

  const startEdit = () => {
    if (disabled) return;
    setDraft(formatQuantity(value));
    setError(null);
    setEditing(true);
  };

  const commitDraft = () => {
    const parsed = parseQuantityInput(draft);
    if (!parsed.ok) {
      setError(parsed.error === 'too_large' ? 'That number is too large.' : 'Enter 0 or more.');
      return;
    }
    const next = bounded(parsed.value);
    setEditing(false);
    setError(null);
    if (next !== value) onChange(next);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  return (
    <div>
      <div role="group" aria-label={`Quantity for ${label}`} className="flex items-center gap-2">
        <button
          type="button"
          className={`${BUTTON_CLASS} ${atMin ? 'opacity-50' : ''}`}
          aria-label={`Decrease ${label} quantity`}
          aria-disabled={atMin || disabled}
          disabled={disabled}
          onClick={() => !atMin && onChange(bounded(value - step))}
        >
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={draft}
            autoFocus
            aria-label={`${label} quantity`}
            aria-invalid={error !== null}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="h-11 w-14 rounded-lg border border-primary-500 bg-white px-1 text-center text-base font-semibold tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={startEdit}
            aria-label={`Edit ${label} quantity, currently ${formatQuantity(value)} ${unitLabel}`}
            className={`h-11 w-14 rounded-lg text-base font-semibold tabular-nums text-gray-900 transition-colors duration-150 ${
              flash ? 'bg-primary-50' : 'bg-transparent'
            }`}
          >
            {formatQuantity(value)}
          </button>
        )}

        <button
          type="button"
          className={`${BUTTON_CLASS} ${atMax ? 'opacity-50' : ''}`}
          aria-label={`Increase ${label} quantity`}
          aria-disabled={atMax || disabled}
          disabled={disabled}
          onClick={() => !atMax && onChange(bounded(value + step))}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>

        <span className="text-sm text-gray-600">{unitLabel}</span>
      </div>

      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
      {announce && (
        <span aria-live="polite" className="sr-only">
          {`${label}: ${formatQuantity(value)} ${unitLabel}`}
        </span>
      )}
    </div>
  );
}
