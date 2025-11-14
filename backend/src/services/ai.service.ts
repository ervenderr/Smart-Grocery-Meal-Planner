/**
 * AI Service
 *
 * Integrates with Google Gemini AI API to provide intelligent features:
 * - Recipe suggestions based on pantry items
 * - Ingredient substitution suggestions
 * - Meal plan generation
 * - Price estimation and budgeting insights
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.config';
import { logger } from '../config/logger.config';
import { AppError } from '../middleware/errorHandler';

export interface RecipeSuggestion {
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
  }>;
  instructions: string[];
  matchPercentage: number; // % of ingredients user already has
}

export interface IngredientSubstitution {
  original: string;
  substitute: string;
  reason: string;
  estimatedSavingsPercent: number;
}

export interface MealPlanSuggestion {
  name: string;
  meals: Array<{
    day: number; // 0-6
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    recipeName: string;
    ingredients: string[];
  }>;
  estimatedCostCents: number;
  totalCalories: number;
}

export class AIService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    if (config.apis.geminiAI) {
      try {
        this.genAI = new GoogleGenerativeAI(config.apis.geminiAI);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        logger.info('Gemini AI initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Gemini AI:', error);
      }
    } else {
      logger.warn('Gemini AI API key not configured - AI features will be disabled');
    }
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return this.model !== null;
  }

  /**
   * Suggest recipes based on available pantry items
   */
  async suggestRecipesFromPantry(
    pantryItems: Array<{ ingredientName: string; quantity: number; unit: string; category: string }>,
    dietaryRestrictions: string[] = [],
    maxPrepTime?: number
  ): Promise<RecipeSuggestion[]> {
    if (!this.isAvailable()) {
      throw new AppError('AI service is not available', 503);
    }

    const prompt = this.buildRecipeSuggestionPrompt(pantryItems, dietaryRestrictions, maxPrepTime);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse AI response into structured recipe suggestions
      return this.parseRecipeSuggestions(text, pantryItems);
    } catch (error: any) {
      logger.error('AI recipe suggestion failed:', error);
      throw new AppError('Failed to generate recipe suggestions', 500);
    }
  }

  /**
   * Suggest ingredient substitutions for shopping list items
   */
  async suggestIngredientSubstitutions(
    ingredients: Array<{ ingredientName: string; quantity: number; unit: string }>,
    budget?: number
  ): Promise<IngredientSubstitution[]> {
    if (!this.isAvailable()) {
      throw new AppError('AI service is not available', 503);
    }

    const prompt = this.buildSubstitutionPrompt(ingredients, budget);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseSubstitutionSuggestions(text);
    } catch (error: any) {
      logger.error('AI substitution suggestion failed:', error);
      throw new AppError('Failed to generate substitution suggestions', 500);
    }
  }

  /**
   * Generate a meal plan based on user preferences and budget
   */
  async generateMealPlan(
    daysCount: number,
    budgetCents: number,
    dietaryRestrictions: string[] = [],
    pantryItems: Array<{ ingredientName: string; quantity: number; unit: string }> = []
  ): Promise<MealPlanSuggestion> {
    if (!this.isAvailable()) {
      throw new AppError('AI service is not available', 503);
    }

    const prompt = this.buildMealPlanPrompt(daysCount, budgetCents, dietaryRestrictions, pantryItems);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseMealPlanSuggestion(text);
    } catch (error: any) {
      logger.error('AI meal plan generation failed:', error);
      throw new AppError('Failed to generate meal plan', 500);
    }
  }

  /**
   * Build prompt for recipe suggestions
   */
  private buildRecipeSuggestionPrompt(
    pantryItems: Array<{ ingredientName: string; quantity: number; unit: string; category: string }>,
    dietaryRestrictions: string[],
    maxPrepTime?: number
  ): string {
    const itemsList = pantryItems.map(item => `${item.quantity} ${item.unit} ${item.ingredientName}`).join(', ');

    let prompt = `You are a creative chef assistant. Based on the following pantry items, suggest 3 delicious recipes that can be made using mostly these ingredients.

Pantry Items: ${itemsList}

Requirements:
- Each recipe should use at least 60% of its ingredients from the pantry items listed above
- Provide recipes with varying difficulty levels (easy, medium, hard)
${dietaryRestrictions.length > 0 ? `- Must respect these dietary restrictions: ${dietaryRestrictions.join(', ')}` : ''}
${maxPrepTime ? `- Total prep + cook time should not exceed ${maxPrepTime} minutes` : ''}
- Include exact quantities and units for ALL ingredients
- Provide clear, step-by-step instructions
- IMPORTANT: For ingredient units, you MUST ONLY use these exact values: lbs, kg, grams, oz, cups, ml, liters, tsp, tbsp, fl_oz, pieces, items
- Do NOT use any other units like "unit", "clove", "pinch", "dash", etc. Convert them to the allowed units

Format your response as a JSON array with this structure:
[
  {
    "name": "Recipe Name",
    "description": "Brief description",
    "difficulty": "easy|medium|hard",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 30,
    "ingredients": [
      {"ingredientName": "ingredient", "quantity": 2, "unit": "cups"}
    ],
    "instructions": ["Step 1", "Step 2"],
    "matchPercentage": 75
  }
]

Respond ONLY with valid JSON, no additional text.`;

    return prompt;
  }

  /**
   * Build prompt for ingredient substitutions
   */
  private buildSubstitutionPrompt(
    ingredients: Array<{ ingredientName: string; quantity: number; unit: string }>,
    budget?: number
  ): string {
    const itemsList = ingredients.map(item => `${item.quantity} ${item.unit} ${item.ingredientName}`).join(', ');

    let prompt = `You are a budget-conscious grocery shopping assistant. For the following shopping list items, suggest cheaper or more readily available substitutes that maintain similar nutritional value and cooking properties.

Shopping List: ${itemsList}

${budget ? `Budget: ₱${(budget / 100).toFixed(2)}` : ''}

Requirements:
- Only suggest substitutions that would save money or improve availability
- Maintain similar taste and nutritional profile
- Provide clear reasoning for each substitution
- Estimate savings percentage

Format your response as a JSON array:
[
  {
    "original": "ingredient name",
    "substitute": "substitute ingredient",
    "reason": "why this substitution works",
    "estimatedSavingsPercent": 25
  }
]

Respond ONLY with valid JSON, no additional text. If no good substitutions exist, return an empty array.`;

    return prompt;
  }

  /**
   * Build prompt for meal plan generation
   */
  private buildMealPlanPrompt(
    daysCount: number,
    budgetCents: number,
    dietaryRestrictions: string[],
    pantryItems: Array<{ ingredientName: string; quantity: number; unit: string }>
  ): string {
    const budget = budgetCents / 100;
    const pantryList = pantryItems.length > 0
      ? pantryItems.map(item => `${item.quantity} ${item.unit} ${item.ingredientName}`).join(', ')
      : 'None';

    let prompt = `You are a meal planning expert. Create a balanced ${daysCount}-day meal plan that fits within a budget of ₱${budget.toFixed(2)}.

Current Pantry Items: ${pantryList}

Requirements:
- Include breakfast, lunch, and dinner for each day
- Balanced nutrition across the week
${dietaryRestrictions.length > 0 ? `- Respect dietary restrictions: ${dietaryRestrictions.join(', ')}` : ''}
- Minimize food waste by using pantry items where possible
- Stay within budget (₱${budget.toFixed(2)})
- Variety across the week (no repeated meals)

Format your response as JSON:
{
  "name": "Budget-Friendly Week Plan",
  "meals": [
    {
      "day": 0,
      "mealType": "breakfast",
      "recipeName": "Scrambled Eggs with Toast",
      "ingredients": ["2 eggs", "2 slices bread", "butter"]
    }
  ],
  "estimatedCostCents": ${budgetCents},
  "totalCalories": 14000
}

Day 0 = Monday, 6 = Sunday. Respond ONLY with valid JSON.`;

    return prompt;
  }

  /**
   * Normalize ingredient unit to match PantryUnit enum
   */
  private normalizeUnit(unit: string): string {
    const unitLower = unit.toLowerCase().trim();

    // Direct matches
    const validUnits = ['lbs', 'kg', 'grams', 'oz', 'cups', 'ml', 'liters', 'tsp', 'tbsp', 'fl_oz', 'pieces', 'items'];
    if (validUnits.includes(unitLower)) {
      return unitLower;
    }

    // Common conversions
    const unitMap: Record<string, string> = {
      'lb': 'lbs',
      'pound': 'lbs',
      'pounds': 'lbs',
      'kilogram': 'kg',
      'kilograms': 'kg',
      'gram': 'grams',
      'g': 'grams',
      'ounce': 'oz',
      'ounces': 'oz',
      'cup': 'cups',
      'c': 'cups',
      'milliliter': 'ml',
      'milliliters': 'ml',
      'liter': 'liters',
      'l': 'liters',
      'teaspoon': 'tsp',
      'teaspoons': 'tsp',
      't': 'tsp',
      'tablespoon': 'tbsp',
      'tablespoons': 'tbsp',
      'tbsp.': 'tbsp',
      'tbs': 'tbsp',
      'T': 'tbsp',
      'fluid ounce': 'fl_oz',
      'fluid ounces': 'fl_oz',
      'fl oz': 'fl_oz',
      'floz': 'fl_oz',
      'piece': 'pieces',
      'pcs': 'pieces',
      'pc': 'pieces',
      'item': 'items',
      'unit': 'pieces',
      'units': 'pieces',
      'whole': 'pieces',
      'clove': 'pieces',
      'cloves': 'pieces',
      'pinch': 'tsp',
      'dash': 'tsp',
      'can': 'items',
      'cans': 'items',
      'bottle': 'items',
      'bottles': 'items',
      'package': 'items',
      'packages': 'items',
    };

    return unitMap[unitLower] || 'pieces'; // Default to pieces if unknown
  }

  /**
   * Parse AI response into recipe suggestions
   */
  private parseRecipeSuggestions(aiResponse: string, pantryItems: any[]): RecipeSuggestion[] {
    try {
      // Extract JSON from response (AI might add extra text)
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.error('No JSON found in AI response:', aiResponse);
        return [];
      }

      const recipes = JSON.parse(jsonMatch[0]);

      // Validate and calculate match percentage
      return recipes.map((recipe: any) => {
        const matchPercentage = this.calculateIngredientMatch(
          recipe.ingredients,
          pantryItems
        );

        // Normalize ingredient units
        const normalizedIngredients = recipe.ingredients.map((ing: any) => ({
          ...ing,
          unit: this.normalizeUnit(ing.unit),
        }));

        return {
          name: recipe.name,
          description: recipe.description,
          difficulty: recipe.difficulty,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
          ingredients: normalizedIngredients,
          instructions: recipe.instructions,
          matchPercentage,
        };
      });
    } catch (error) {
      logger.error('Failed to parse recipe suggestions:', error);
      return [];
    }
  }

  /**
   * Parse AI response into substitution suggestions
   */
  private parseSubstitutionSuggestions(aiResponse: string): IngredientSubstitution[] {
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Failed to parse substitution suggestions:', error);
      return [];
    }
  }

  /**
   * Parse AI response into meal plan suggestion
   */
  private parseMealPlanSuggestion(aiResponse: string): MealPlanSuggestion {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Failed to parse meal plan suggestion:', error);
      throw new AppError('Failed to parse AI meal plan response', 500);
    }
  }

  /**
   * Calculate how many ingredients the user already has
   */
  private calculateIngredientMatch(
    recipeIngredients: Array<{ ingredientName: string }>,
    pantryItems: Array<{ ingredientName: string }>
  ): number {
    if (recipeIngredients.length === 0) return 0;

    const pantryNames = new Set(
      pantryItems.map(item => item.ingredientName.toLowerCase())
    );

    const matchCount = recipeIngredients.filter(ingredient =>
      pantryNames.has(ingredient.ingredientName.toLowerCase())
    ).length;

    return Math.round((matchCount / recipeIngredients.length) * 100);
  }
}

// Export singleton instance
export const aiService = new AIService();
