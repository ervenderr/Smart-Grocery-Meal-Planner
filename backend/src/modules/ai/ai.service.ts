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
import { config } from '../../config/env.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';

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
        // Use gemini-1.5-flash (free tier, fast) or gemini-1.5-pro (more capable)
        this.model = this.genAI.getGenerativeModel({
          model: 'gemini-flash-latest',
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 4096,
          },
        });
        logger.info('Gemini AI initialized successfully', {
          service: 'smart-grocery-api',
          model: 'gemini-flash-latest',
          apiKeyLength: config.apis.geminiAI.length,
          apiKeyPrefix: config.apis.geminiAI.substring(0, 10) + '...',
        });
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

    logger.debug('Sending prompt to Gemini AI', {
      service: 'smart-grocery-api',
      promptLength: prompt.length,
      pantryItemsCount: pantryItems.length,
    });

    try {
      const result = await this.model.generateContent(prompt);

      logger.debug('Gemini response received, extracting text', {
        service: 'smart-grocery-api',
      });

      const response = await result.response;
      const text = response.text();

      logger.debug('Received response from Gemini AI', {
        service: 'smart-grocery-api',
        responseLength: text.length,
        preview: text.substring(0, 200),
      });

      // Parse AI response into structured recipe suggestions
      const suggestions = this.parseRecipeSuggestions(text, pantryItems);

      logger.info('Recipe suggestions parsed successfully', {
        service: 'smart-grocery-api',
        count: suggestions.length,
      });

      return suggestions;
    } catch (error: any) {
      // Check for specific Gemini errors
      if (error.message?.includes('API key')) {
        logger.error('Invalid Gemini API key');
        throw new AppError('Invalid AI API key. Please check your GEMINI_AI_API_KEY in .env', 500);
      }

      if (error.message?.includes('quota')) {
        logger.error('Gemini API quota exceeded');
        throw new AppError('AI service quota exceeded. Please try again later.', 503);
      }

      logger.error('AI recipe suggestion failed - Full error:', {
        message: error.message,
        name: error.name,
        cause: error.cause,
        errorDetails: error.errorDetails,
      });
      throw new AppError(`Failed to generate recipe suggestions: ${error.message || 'Unknown error'}`, 500);
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
      logger.error('AI meal plan generation failed - Full error:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        errorDetails: JSON.stringify(error, null, 2),
      });
      throw new AppError(`Failed to generate meal plan: ${error.message}`, 500);
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

        return {
          name: recipe.name,
          description: recipe.description,
          difficulty: recipe.difficulty,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
          ingredients: recipe.ingredients,
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
