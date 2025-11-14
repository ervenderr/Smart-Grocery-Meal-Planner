'use client';

import { useState } from 'react';
import { X, Sparkles, ChefHat, Clock, TrendingUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { aiApi, type RecipeSuggestion } from '@/lib/api/ai';
import { recipeApi } from '@/lib/api/recipes';
import toast from 'react-hot-toast';

interface AIRecipeSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeAdded?: () => void;
}

export function AIRecipeSuggestionsModal({
  isOpen,
  onClose,
  onRecipeAdded,
}: AIRecipeSuggestionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [pantryItemsUsed, setPantryItemsUsed] = useState(0);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSuggestion | null>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);

  const handleGenerateSuggestions = async () => {
    setLoading(true);
    try {
      const result = await aiApi.suggestRecipes({ usePantry: true });
      setSuggestions(result.suggestions);
      setPantryItemsUsed(result.pantryItemsUsed);
      toast.success(`Generated ${result.suggestions.length} recipe suggestions!`);
    } catch (error: any) {
      console.error('AI suggestion error:', error);
      toast.error(error.response?.data?.error || 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecipe = async (suggestion: RecipeSuggestion) => {
    setSavingRecipe(true);
    try {
      await recipeApi.create({
        name: suggestion.name,
        description: suggestion.description,
        category: 'dinner', // Default category
        difficulty: suggestion.difficulty,
        prepTimeMinutes: suggestion.prepTimeMinutes,
        cookTimeMinutes: suggestion.cookTimeMinutes,
        servings: 4, // Default servings
        ingredients: suggestion.ingredients.map(ing => ({
          ...ing,
          unit: ing.unit as any, // AI may return various unit formats
        })),
        instructions: suggestion.instructions,
        tags: ['AI Generated'],
        dietaryRestrictions: [],
      });

      toast.success('Recipe saved successfully!');
      onRecipeAdded?.();
      onClose();
    } catch (error: any) {
      console.error('Save recipe error:', error);
      toast.error('Failed to save recipe');
    } finally {
      setSavingRecipe(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/50" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI Recipe Suggestions</h2>
              <p className="text-sm text-gray-600">Powered by Google Gemini AI</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {suggestions.length === 0 ? (
            <div className="text-center py-12">
              <div className="rounded-full bg-purple-100 p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <ChefHat className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Get Recipe Suggestions
              </h3>
              <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
                Let AI analyze your pantry items and suggest delicious recipes you can make right now
              </p>
              <Button onClick={handleGenerateSuggestions} disabled={loading}>
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Analyzing your pantry...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Suggestions
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-900">
                  <strong>{pantryItemsUsed} pantry items</strong> analyzed • {suggestions.length} recipes suggested
                </p>
              </div>

              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {suggestion.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>

                      <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {suggestion.prepTimeMinutes + suggestion.cookTimeMinutes} min
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          {suggestion.matchPercentage}% match
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          suggestion.difficulty === 'easy'
                            ? 'bg-green-100 text-green-700'
                            : suggestion.difficulty === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {suggestion.difficulty}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleSaveRecipe(suggestion)}
                      disabled={savingRecipe}
                    >
                      <Plus className="h-4 w-4" />
                      Save Recipe
                    </Button>
                  </div>

                  {selectedRecipe === suggestion && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2">Ingredients:</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600 mb-4">
                        {suggestion.ingredients.map((ing, i) => (
                          <li key={i}>
                            {ing.quantity} {ing.unit} {ing.ingredientName}
                          </li>
                        ))}
                      </ul>

                      <h4 className="font-semibold text-gray-900 mb-2">Instructions:</h4>
                      <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                        {suggestion.instructions.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedRecipe(selectedRecipe === suggestion ? null : suggestion)}
                    className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {selectedRecipe === suggestion ? 'Hide Details' : 'View Details'}
                  </button>
                </div>
              ))}

              <div className="text-center pt-4">
                <Button variant="outline" onClick={handleGenerateSuggestions} disabled={loading}>
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate New Suggestions
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
