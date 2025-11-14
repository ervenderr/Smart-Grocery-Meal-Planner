'use client';

import { useState } from 'react';
import { X, Sparkles, ArrowRight, TrendingDown, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { aiApi, type IngredientSubstitution } from '@/lib/api/ai';
import toast from 'react-hot-toast';

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
  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>([]);
  const [budgetCents, setBudgetCents] = useState<number>(50000); // ₱500 default

  const handleGenerateSubstitutions = async () => {
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

      if (result.suggestions.length === 0) {
        toast('No substitutions found for the selected ingredients', {
          icon: '🤷',
        });
      } else {
        setSuggestions(result.suggestions);
        toast.success(`Found ${result.suggestions.length} substitution suggestions!`);
      }
    } catch (error: any) {
      console.error('Substitution error:', error);
      const message = error.response?.data?.error || 'Failed to generate substitutions';
      toast.error(message);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/50" onClick={handleClose}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI Ingredient Substitution</h2>
              <p className="text-sm text-gray-600">Find cheaper or available alternatives</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-lg p-2 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {suggestions.length === 0 ? (
            <div className="space-y-6">
              {/* Budget Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget Target (₱{(budgetCents / 100).toFixed(2)})
                </label>
                <input
                  type="range"
                  min="1000"
                  max="200000"
                  step="1000"
                  value={budgetCents}
                  onChange={(e) => setBudgetCents(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>₱10</span>
                  <span>₱2,000</span>
                </div>
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
                disabled={loading || selectedIngredients.length === 0}
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
