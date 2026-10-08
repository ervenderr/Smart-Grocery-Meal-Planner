'use client';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SUPPORTED_CURRENCIES } from '@/lib/currency/currencies';
import { currencyOptionLabel } from '@/lib/currency/format';
import { parseBudgetInput } from '@/lib/currency/budget';

export const BUDGET_STEP_TITLE = "Let's set up your kitchen";
/** Returns an error message when a non-empty budget cannot be parsed. */
export function budgetError(budgetInput: string, currency?: string): string | undefined {
  if (budgetInput.trim() === '') return undefined;
  const parsed = parseBudgetInput(budgetInput, currency);
  return parsed.ok ? undefined : parsed.message;
}

interface StepBudgetProps {
  currency: string;
  budgetInput: string;
  showErrors: boolean;
  onCurrencyChange: (currency: string) => void;
  onBudgetChange: (value: string) => void;
}

export function StepBudget({
  currency,
  budgetInput,
  showErrors,
  onCurrencyChange,
  onBudgetChange,
}: StepBudgetProps) {
  const error = showErrors ? budgetError(budgetInput, currency) : undefined;

  return (
    <div className="space-y-6">
      <p className="text-base text-gray-600">
        Tell us your weekly grocery budget so Kitcha can keep you on track.
      </p>
      <Select
        label="Currency"
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {currencyOptionLabel(c.code)}
          </option>
        ))}
      </Select>
      <div className="relative">
        <Input
          label="Weekly grocery budget"
          inputMode="decimal"
          placeholder="e.g. 2000"
          value={budgetInput}
          onChange={(e) => onBudgetChange(e.target.value)}
          error={error}
          className="pr-16"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-[calc(1.25rem+0.5rem+0.75rem)] text-sm font-semibold text-gray-600"
        >
          {currency}
        </span>
      </div>
    </div>
  );
}
