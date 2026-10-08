'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Save, Loader2, Banknote, Bell, Utensils } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { preferencesApi } from '@/lib/api/preferences';
import { usePreferences, PREFERENCES_QUERY_KEY } from '@/lib/hooks/use-preferences';
import { DIETARY_OPTIONS } from '@/lib/constants/dietary';
import { SUPPORTED_CURRENCIES, isSupportedCurrency } from '@/lib/currency/currencies';
import {
  DEFAULT_CURRENCY,
  centsToMajorString,
  currencyOptionLabel,
} from '@/lib/currency/format';
import { MAX_BUDGET_CENTS, parseBudgetInput } from '@/lib/currency/budget';
import toast from 'react-hot-toast';

const MIN_BUDGET_CENTS = 100;
const DEFAULT_BUDGET_CENTS = 200000;

const preferencesSchema = z.object({
  budgetPerWeekCents: z
    .number()
    .min(MIN_BUDGET_CENTS, 'Enter a weekly budget of at least 1')
    .max(MAX_BUDGET_CENTS, 'Enter a smaller weekly budget'),
  currency: z.string(),
  alertEnabled: z.boolean(),
  alertThresholdPercentage: z.number().min(1).max(100),
  mealsPerDay: z.number().min(1).max(10),
  dietaryRestrictions: z.array(z.string()),
  preferredUnit: z.enum(['kg', 'lb']),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

const FORM_DEFAULTS: PreferencesFormData = {
  budgetPerWeekCents: DEFAULT_BUDGET_CENTS,
  currency: DEFAULT_CURRENCY,
  alertEnabled: true,
  alertThresholdPercentage: 90,
  mealsPerDay: 3,
  dietaryRestrictions: [],
  preferredUnit: 'kg',
};

export function PreferencesSettings() {
  const queryClient = useQueryClient();
  const { data: preferences, isLoading: fetching } = usePreferences();
  const [loading, setLoading] = useState(false);
  const [budgetText, setBudgetText] = useState(centsToMajorString(DEFAULT_BUDGET_CENTS));
  const [budgetTouched, setBudgetTouched] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    getValues,
    setValue,
  } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: FORM_DEFAULTS,
  });

  const currency = watch('currency');
  const alertEnabled = watch('alertEnabled');
  const dietaryRestrictions = watch('dietaryRestrictions');

  useEffect(() => {
    if (!preferences) return;
    const values: PreferencesFormData = {
      budgetPerWeekCents: preferences.budgetPerWeekCents || DEFAULT_BUDGET_CENTS,
      currency: preferences.currency || DEFAULT_CURRENCY,
      alertEnabled: preferences.alertEnabled ?? true,
      alertThresholdPercentage: preferences.alertThresholdPercentage || 90,
      mealsPerDay: preferences.mealsPerDay || 3,
      dietaryRestrictions: preferences.dietaryRestrictions || [],
      preferredUnit: preferences.preferredUnit === 'lb' ? 'lb' : 'kg',
    };
    reset(values);
    setBudgetText(centsToMajorString(values.budgetPerWeekCents));
    setBudgetTouched(false);
  }, [preferences, reset]);

  const handleBudgetChange = (text: string) => {
    setBudgetText(text);
    setBudgetTouched(true);
    const parsed = parseBudgetInput(text, currency);
    // An unparseable value maps to 0 so the schema blocks submit
    setValue('budgetPerWeekCents', parsed.ok ? parsed.cents : 0, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  // Only judge the text once edited, so a legacy stored value never blocks other saves
  const typedBudget = budgetTouched ? parseBudgetInput(budgetText, currency) : null;
  const budgetTextError = typedBudget && !typedBudget.ok ? typedBudget.message : undefined;

  const onSubmit = async (data: PreferencesFormData) => {
    if (budgetTextError) return;
    setLoading(true);
    try {
      const saved = await preferencesApi.update(data);
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, saved);
      toast.success('Preferences updated successfully');
      reset(data);
    } catch (error: any) {
      console.error('Update preferences error:', error);
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    reset();
    setBudgetText(centsToMajorString(getValues('budgetPerWeekCents')));
    setBudgetTouched(false);
  };

  const toggleDietaryRestriction = (value: string) => {
    const current = dietaryRestrictions || [];
    const next = current.includes(value) ? current.filter((r) => r !== value) : [...current, value];
    setValue('dietaryRestrictions', next, { shouldDirty: true });
  };

  const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
  const currencyOptions = isSupportedCurrency(currency) ? codes : [...codes, currency];

  if (fetching) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
        <p className="text-sm text-gray-600 mt-1">Customize your experience and set your defaults</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Budget Settings */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Banknote className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Budget Settings</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Select label="Currency" {...register('currency')}>
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {isSupportedCurrency(code) ? currencyOptionLabel(code) : code}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-sm text-gray-500">
                Changing currency only changes how amounts are shown. Existing amounts are not
                converted.
              </p>
            </div>

            <Input
              label="Weekly grocery budget"
              type="text"
              inputMode="decimal"
              value={budgetText}
              onChange={(e) => handleBudgetChange(e.target.value)}
              error={budgetTextError ?? errors.budgetPerWeekCents?.message}
              suffix={currency}
              className="pr-16"
            />

            <Select label="Preferred Unit" {...register('preferredUnit')}>
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </Select>
          </div>
        </div>

        {/* Alert Settings */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Alert Settings</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p id="budget-alerts-label" className="text-sm font-semibold text-gray-900">
                  Budget Alerts
                </p>
                <p className="text-sm text-gray-500">Get notified when you approach your budget limit</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={alertEnabled}
                aria-labelledby="budget-alerts-label"
                onClick={() => setValue('alertEnabled', !alertEnabled, { shouldDirty: true })}
                className="inline-flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <span
                  className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    alertEnabled ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      alertEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </div>

            {alertEnabled && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Alert Threshold ({watch('alertThresholdPercentage')}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  {...register('alertThresholdPercentage', { valueAsNumber: true })}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Meal Planning */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Utensils className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Meal Planning</h3>
          </div>

          <div className="space-y-4">
            <Input
              label="Meals Per Day"
              type="number"
              min="1"
              max="10"
              error={errors.mealsPerDay?.message}
              {...register('mealsPerDay', { valueAsNumber: true })}
            />

            <fieldset>
              <legend className="block text-sm font-semibold text-gray-900 mb-2">
                Dietary Restrictions
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {DIETARY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex min-h-11 cursor-pointer items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={dietaryRestrictions?.includes(option.value)}
                      onChange={() => toggleDietaryRestriction(option.value)}
                      className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 pt-6 border-t border-gray-200 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={!isDirty || loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!isDirty || loading} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
