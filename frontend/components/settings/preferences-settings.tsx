'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Banknote, Bell, Utensils } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';

const preferencesSchema = z.object({
  budgetPerWeekCents: z.number().min(100, 'Budget must be at least ₱1').max(10000000),
  currency: z.string(),
  alertEnabled: z.boolean(),
  alertThresholdPercentage: z.number().min(1).max(100),
  mealsPerDay: z.number().min(1).max(10),
  dietaryRestrictions: z.array(z.string()),
  preferredUnit: z.enum(['kg', 'lb']),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

const DIETARY_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten-Free' },
  { value: 'dairy_free', label: 'Dairy-Free' },
  { value: 'nut_free', label: 'Nut-Free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
];

export function PreferencesSettings() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      budgetPerWeekCents: 200000, // ₱2000
      currency: 'PHP',
      alertEnabled: true,
      alertThresholdPercentage: 90,
      mealsPerDay: 3,
      dietaryRestrictions: [],
      preferredUnit: 'kg',
    },
  });

  const budgetPesos = watch('budgetPerWeekCents') / 100;
  const alertEnabled = watch('alertEnabled');
  const dietaryRestrictions = watch('dietaryRestrictions');

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await apiClient.get('/api/v1/users/preferences');
        reset({
          budgetPerWeekCents: response.budgetPerWeekCents || 200000,
          currency: response.currency || 'PHP',
          alertEnabled: response.alertEnabled ?? true,
          alertThresholdPercentage: response.alertThresholdPercentage || 90,
          mealsPerDay: response.mealsPerDay || 3,
          dietaryRestrictions: response.dietaryRestrictions || [],
          preferredUnit: response.preferredUnit || 'kg',
        });
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
      } finally {
        setFetching(false);
      }
    };

    fetchPreferences();
  }, [reset]);

  const onSubmit = async (data: PreferencesFormData) => {
    setLoading(true);
    try {
      await apiClient.patch('/api/v1/users/preferences', data);
      toast.success('Preferences updated successfully');
      reset(data);
    } catch (error: any) {
      console.error('Update preferences error:', error);
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  const toggleDietaryRestriction = (value: string) => {
    const current = dietaryRestrictions || [];
    if (current.includes(value)) {
      setValue('dietaryRestrictions', current.filter(r => r !== value), { shouldDirty: true });
    } else {
      setValue('dietaryRestrictions', [...current, value], { shouldDirty: true });
    }
  };

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
        <p className="text-sm text-gray-600 mt-1">
          Customize your experience and set your defaults
        </p>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weekly Budget (₱{budgetPesos.toFixed(2)})
              </label>
              <input
                type="range"
                min="10000"
                max="1000000"
                step="10000"
                {...register('budgetPerWeekCents', { valueAsNumber: true })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>₱100</span>
                <span>₱10,000</span>
              </div>
              {errors.budgetPerWeekCents && (
                <p className="mt-1 text-sm text-red-600">{errors.budgetPerWeekCents.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Unit
              </label>
              <select
                {...register('preferredUnit')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alert Settings */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Alert Settings</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Budget Alerts</p>
                <p className="text-xs text-gray-500">Get notified when you approach your budget limit</p>
              </div>
              <button
                type="button"
                onClick={() => setValue('alertEnabled', !alertEnabled, { shouldDirty: true })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  alertEnabled ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    alertEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {alertEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <div className="flex justify-between text-xs text-gray-500 mt-1">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meals Per Day
              </label>
              <input
                type="number"
                min="1"
                max="10"
                {...register('mealsPerDay', { valueAsNumber: true })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
              {errors.mealsPerDay && (
                <p className="mt-1 text-sm text-red-600">{errors.mealsPerDay.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Dietary Restrictions
              </label>
              <div className="grid grid-cols-2 gap-3">
                {DIETARY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={dietaryRestrictions?.includes(option.value)}
                      onChange={() => toggleDietaryRestriction(option.value)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!isDirty || loading}>
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
