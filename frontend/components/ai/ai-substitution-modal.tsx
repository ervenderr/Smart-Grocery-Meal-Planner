'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles, ArrowRight, TrendingDown, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { aiApi, type IngredientSubstitution } from '@/lib/api/ai';
import { getApiErrorMessage } from '@/lib/api/errors';
import { useCurrency } from '@/lib/currency/currency-provider';
import { centsToMajorString, parseMajorToCents } from '@/lib/currency/format';
import { DietFilterNotice } from './diet-filter-notice';
import toast from 'react-hot-toast';

const DEFAULT_BUDGET_CENTS = 50000;
const MIN_BUDGET_CENTS = 100;
const MAX_BUDGET_CENTS = 100_000_000;
const BUDGET_ERROR = 'Enter a budget of 1 or more';

interface Ingredient {
  ingredientName: string;
  quantity: number;
  unit: string;
}

interface AISubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  onApplySubstitution?: (original: string, substitute: string) => void;
}

export function AISubstitutionModal({
  isOpen,
  onClose,
  ingredients,
  onApplySubstitution,
}: AISubstitutionModalProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<IngredientSubstitution[]>([]);
  const [filteredOut, setFilteredOut] = useState(0);
  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>([]);
  const [budgetCents, setBudgetCents] = useState<number>(DEFAULT_BUDGET_CENTS);
  const [budgetInput, setBudgetInput] = useState(centsToMajorString(DEFAULT_BUDGET_CENTS));
  const [budgetError, setBudgetError] = useState<string | undefined>(undefined);
  const { currency } = useCurrency();

  const handleBudgetChange = (value: string) => {
    setBudgetInput(value);
    const cents = parseMajorToCents(value, currency);
    if (cents === null || cents < MIN_BUDGET_CENTS || cents > MAX_BUDGET_CENTS) {
      setBudgetError(BUDGET_ERROR);
      return;
    }
    setBudgetError(undefined);
    setBudgetCents(cents);
  };

  const handleGenerateSubstitutions = async () => {
    if (budgetError) return;
    if (selectedIngredients.length === 0) {
      toast.error('Please select at least one ingredient to substitute');
      return;
    }

    setLoading(true);
    try {
      const result = await aiApi.suggestSubstitutions(
        selectedIngredients,
        budgetCents
      );

      setFilteredOut(result.filteredOut ?? 0);
      if (result.suggestions.length === 0) {
        toast((result.filteredOut ?? 0) > 0
          ? `No substitutions to show: ${result.filteredOut} hidden by your dietary settings (keyword check, not a medical guarantee)`
          : 'No substitutions found for the selected ingredients', {
          icon: '🤷',
        });
      } else {
        setSuggestions(result.suggestions);
        toast.success(`Found ${result.suggestions.length} substitution suggestions!`);
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to generate substitutions'));
    } finally {
      setLoading(false);
    }
  };

  const toggleIngredientSelection = (ingredient: Ingredient) => {
    setSelectedIngredients((prev) => {
      const isSelected = prev.some(
        (i) => i.ingredientName === ingredient.ingredientName
      );
      if (isSelected) {
        return prev.filter((i) => i.ingredientName !== ingredient.ingredientName);
      } else {
        return [...prev, ingredient];
      }
    });
  };

  const handleApply = (suggestion: IngredientSubstitution) => {
    if (onApplySubstitution) {
      onApplySubstitution(suggestion.original, suggestion.substitute);
      toast.success(`Replaced ${suggestion.original} with ${suggestion.substitute}`);
    }
  };

  const handleClose = () => {
    setSuggestions([]);
    setSelectedIngredients([]);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/50" onClick={handleClose}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[90dvh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-substitution-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 id="ai-substitution-title" className="text-xl font-bold text-gray-900">AI Ingredient Substitution</h2>
              <p className="text-sm text-gray-600">Find cheaper or available alternatives</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {suggestions.length === 0 ? (
            <div className="space-y-6">
              {/* Budget Input */}
              <div>
                <Input
                  label={`Budget target (${currency})`}
                  type="text"
                  inputMode="decimal"
                  value={budgetInput}
                  onChange={(e) => handleBudgetChange(e.target.value)}
                  error={budgetError}
                />
              </div>

              {/* Ingredient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select ingredients to substitute ({selectedIngredients.length} selected)
                </label>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {ingredients.map((ingredient, index) => {
                    const isSelected = selectedIngredients.some(
                      (i) => i.ingredientName === ingredient.ingredientName
                    );
                    return (
                      <div
                        key={index}
                        onClick={() => toggleIngredientSelection(ingredient)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleIngredientSelection(ingredient)}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {ingredient.ingredientName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {ingredient.quantity} {ingredient.unit}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleGenerateSubstitutions}
                className="w-full"
                disabled={loading || selectedIngredients.length === 0 || Boolean(budgetError)}
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Finding alternatives...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Find Substitutions
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <DietFilterNotice filteredOut={filteredOut} />

              {/* Summary */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">
                    Found {suggestions.length} Substitution{suggestions.length !== 1 ? 's' : ''}
                  </h3>
                </div>
                <p className="text-sm text-purple-700">
                  AI suggested alternatives based on availability and budget
                </p>
              </div>

              {/* Substitution Cards */}
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Original → Substitute */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex-1">
                            <p className="text-sm text-gray-500 mb-1">Original</p>
                            <p className="font-semibold text-gray-900 line-through decoration-red-500">
                              {suggestion.original}
                            </p>
                          </div>

                          <ArrowRight className="h-5 w-5 text-purple-600 flex-shrink-0" />

                          <div className="flex-1">
                            <p className="text-sm text-gray-500 mb-1">Substitute</p>
                            <p className="font-semibold text-purple-900">
                              {suggestion.substitute}
                            </p>
                          </div>
                        </div>

                        {/* Reason */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <p className="text-sm text-gray-700">{suggestion.reason}</p>
                        </div>

                        {/* Savings */}
                        {suggestion.estimatedSavingsPercent > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingDown className="h-4 w-4 text-green-600" />
                            <span className="text-green-700 font-medium">
                              Save ~{suggestion.estimatedSavingsPercent}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Apply Button */}
                      {onApplySubstitution && (
                        <Button
                          onClick={() => handleApply(suggestion)}
                          variant="outline"
                          size="sm"
                          className="mt-8"
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuggestions([]);
                    setSelectedIngredients([]);
                  }}
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
