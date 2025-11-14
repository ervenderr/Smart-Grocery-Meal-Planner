# Kitcha: Complete Implementation Guide

## Table of Contents
1. [Project Overview & Architecture](#project-overview--architecture)
2. [Core Concepts & Design Principles](#core-concepts--design-principles)
3. [Database Design & Data Modeling](#database-design--data-modeling)
4. [Backend Architecture](#backend-architecture)
5. [AI Integration Strategy](#ai-integration-strategy)
6. [Frontend Architecture](#frontend-architecture)
7. [Implementation Phases](#implementation-phases)
8. [Best Practices & Pitfalls](#best-practices--pitfalls)

---

## Project Overview & Architecture

### Why This Project Structure?

Before diving into code, understand what we're building and why:

**The Problem**: Users waste money, time, and food because they:
- Don't know what meals they can make with what they have
- Aren't strategic about grocery shopping
- Don't plan meals, leading to impulse purchases
- Have conflicting dietary preferences in households

**Our Solution**: An app that bridges these gaps by:
1. **Knowing their pantry** - what ingredients they have and when they expire
2. **Suggesting recipes** - based on what they already have (AI-powered)
3. **Planning meals** - weekly plans optimized for budget, calories, preferences
4. **Optimizing shopping** - suggesting cheaper alternatives and preventing duplicates

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Next.js App (TailwindCSS + React Query)                   │ │
│  │  - Pantry Dashboard                                         │ │
│  │  - Recipe Suggestions UI                                   │ │
│  │  - Meal Plan Calendar                                      │ │
│  │  - Shopping List Generator                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP/REST API Calls
┌──────────────────────▼──────────────────────────────────────────┐
│                    Backend Server                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Node.js + Express/NestJS                                  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ API Routes                                           │  │ │
│  │  │ - /auth/* (login, register, JWT)                    │  │ │
│  │  │ - /pantry/* (CRUD operations)                       │  │ │
│  │  │ - /recipes/* (AI suggestions)                       │  │ │
│  │  │ - /meal-plans/* (planning & optimization)           │  │ │
│  │  │ - /shopping-list/* (generation & optimization)      │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ Business Logic Layer                                 │  │ │
│  │  │ - Pantry management                                 │  │ │
│  │  │ - AI service (Gemini 2.5 Flash integration)         │  │ │
│  │  │ - Meal planning algorithms                          │  │ │
│  │  │ - Shopping list optimization                        │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Database Queries
┌──────────────────────▼──────────────────────────────────────────┐
│                 PostgreSQL Database                              │
│  - Users table                                                  │
│  - Pantry items (user's ingredients)                            │
│  - Recipes (either stored or from Spoonacular)                  │
│  - Meal plans (user's meal schedules)                           │
│  - Shopping lists (generated & saved)                           │
│  - User preferences (dietary, budget, favorites)                │
└─────────────────────────────────────────────────────────────────┘
```

**Key Architectural Principles:**

1. **Separation of Concerns**: Frontend (UI), Backend (business logic), Database (persistence)
2. **Stateless API**: Backend doesn't maintain session state; JWT handles authentication
3. **Caching Layer**: React Query on frontend caches API responses to reduce redundant calls
4. **AI as a Service**: Gemini API calls are isolated in a dedicated service layer
5. **Scalability**: Design assumes multiple users; database queries are indexed appropriately

---

## Core Concepts & Design Principles

### 1. Authentication & Authorization

**Why JWT over sessions?**
- Sessions require server-side storage (doesn't scale well)
- JWT is stateless — the token itself contains the user's identity
- Perfect for distributed systems and mobile apps

**How it works:**
1. User logs in with email/password
2. Backend validates credentials, generates JWT token
3. Frontend stores JWT (localStorage/secure cookie)
4. Every API request includes JWT in Authorization header
5. Backend verifies JWT before processing request

```
User submits login → 
  Backend validates password → 
    Backend signs JWT with secret → 
      Sends JWT to frontend → 
        Frontend includes JWT in all requests →
          Backend verifies signature (ensures it hasn't been tampered with)
```

**Important**: Never store sensitive data (passwords, API keys) in JWT. The token can be decoded by anyone — it's authenticated but not encrypted.

### 2. Pantry Management

**Core Concept**: Each user has a pantry (list of ingredients they own).

**Why it matters for the app:**
- Basis for recipe suggestions (AI looks at what they have)
- Tracking expiration dates prevents waste
- Shopping list logic: don't suggest buying what they already have

**Data we track:**
- Ingredient name (e.g., "chicken breast")
- Quantity (e.g., 2 lbs)
- Unit (lbs, kg, cups, pieces)
- Expiration date (when to discard)
- Category (protein, vegetable, spice) — helps with organization
- Date added — for analytics

### 3. Recipe Intelligence

**Why AI here?**
- Hard-coded rules would be fragile ("if pantry has chicken and rice, suggest fried rice" — what about allergies, preferences?)
- AI can understand context, preferences, and constraints

**What AI does:**
1. User provides pantry items + dietary restrictions
2. AI generates recipe suggestions that use MOST of those items
3. AI can optimize for time, cost, calories, macros

**Example AI Prompt Structure:**
```
"Here are the ingredients I have: [chicken, rice, carrots, onions, soy sauce]
My preferences: [low-carb, vegetarian options, 30-minute meals]
Generate 3 recipes I can make. For each, list:
- Recipe name
- Ingredients needed (from what I have + what I need to buy)
- Estimated time
- Calorie count
- Why it's a good fit for my pantry"
```

**Important Design Choice**: Why NOT store AI responses in the database?
- AI is non-deterministic (same input might give slightly different output)
- Recipe recommendations are expensive to store and manage
- Generate fresh suggestions on-demand is better UX
- Exception: User-saved favorite recipes — those we store

### 4. Meal Planning Optimization

**The Problem**: Suggesting 5 meals is different from planning a whole week optimally.

**What "Optimal" means depends on user goals:**
- Budget: minimize total cost
- Calories: hit daily targets
- Nutrition: balance macros (protein, carbs, fats)
- Variety: don't repeat same meals
- Feasibility: account for time constraints
- Preferences: respect dietary needs and likes/dislikes

**How it works:**
1. AI generates a pool of candidate recipes
2. AI applies constraints and preferences
3. AI creates a weekly calendar that satisfies all constraints
4. User can tweak/swap meals
5. Meal plan feeds into shopping list generation

### 5. Shopping List Optimization

**What we're optimizing:**
- Removing duplicates ("chicken breast" appears in 3 recipes — buy once with right quantity)
- Suggesting substitutes (fresh garlic vs pre-minced — cost difference)
- Seasonal alternatives (strawberries in winter are expensive; suggest in-season berries)
- Store layout (group items by aisle for faster shopping)

**Why this matters**: Users often buy duplicate items or overpay for non-seasonal produce. AI can suggest smarter alternatives without losing quality.

---

## Database Design & Data Modeling

### Why PostgreSQL?

**Structured data**: Grocery data is relational (users → pantry items, recipes, meal plans)
**ACID guarantees**: Ensures consistency (e.g., if you remove a recipe, its links are handled)
**Powerful queries**: JOINs make it easy to fetch "all ingredients for a meal plan"
**Scalability**: Handles thousands of concurrent users with proper indexing

### Core Tables & Relationships

#### 1. Users Table
```
users
├── id (UUID, PRIMARY KEY)
├── email (VARCHAR, UNIQUE) — login identifier
├── password_hash (VARCHAR) — bcrypt hash, NEVER store plain password
├── created_at (TIMESTAMP)
├── preferences (JSONB) — flexible user settings
│   ├── dietary_restrictions (array: vegan, gluten-free, keto, etc.)
│   ├── budget_range (monthly, in cents: 10000 = $100)
│   ├── cooking_time_preference (minutes: 15, 30, 60)
│   └── favorite_cuisines (array: italian, asian, mexican)
```

**Why JSONB for preferences?**
- Users' preferences vary widely (some care about budget, others about macros)
- Adding new preference types doesn't require database migration
- Makes sense for PostgreSQL specifically (native JSON support)

#### 2. Pantry Items Table
```
pantry_items
├── id (UUID, PRIMARY KEY)
├── user_id (UUID, FOREIGN KEY → users.id)
├── ingredient_name (VARCHAR)
├── quantity (DECIMAL) — 2.5 cups, 500 grams, etc.
├── unit (VARCHAR) — cups, grams, pieces, ml
├── category (VARCHAR) — protein, vegetable, spice, dairy
├── expiration_date (DATE) — nullable (some items don't expire)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
├── UNIQUE INDEX on (user_id, ingredient_name) — user can't have duplicates
```

**Design Decision**: Why separate `quantity` and `unit`?
- Allows flexible queries ("find all items expiring this week")
- Conversion logic handled in application code (1 cup = ~240ml)
- Stores user's preferred unit (some use metric, others imperial)

#### 3. Recipes Table
```
recipes
├── id (UUID, PRIMARY KEY)
├── external_id (VARCHAR, nullable) — if from Spoonacular API
├── title (VARCHAR)
├── description (TEXT)
├── prep_time (INTEGER) — minutes
├── cook_time (INTEGER)
├── servings (INTEGER)
├── calories_per_serving (DECIMAL)
├── ingredients_list (JSONB) — structured list
│   [
│     { "name": "chicken breast", "amount": 2, "unit": "lbs" },
│     { "name": "rice", "amount": 1, "unit": "cup" }
│   ]
├── instructions (TEXT)
├── created_at (TIMESTAMP)
```

**Why JSONB for ingredients_list?**
- Each recipe has different ingredient counts
- No need for separate table; JSONB is performant in PostgreSQL
- Allows complex queries: `WHERE ingredients_list @> '{"name": "chicken"}'`

#### 4. Meal Plans Table
```
meal_plans
├── id (UUID, PRIMARY KEY)
├── user_id (UUID, FOREIGN KEY → users.id)
├── name (VARCHAR) — e.g., "Week of Nov 12"
├── start_date (DATE)
├── end_date (DATE)
├── created_at (TIMESTAMP)
├── is_favorite (BOOLEAN) — users can save meal plans to reuse
```

#### 5. Meal Plan Items Table
```
meal_plan_items
├── id (UUID, PRIMARY KEY)
├── meal_plan_id (UUID, FOREIGN KEY → meal_plans.id)
├── recipe_id (UUID, FOREIGN KEY → recipes.id)
├── day_of_week (INTEGER) — 0 = Monday, 6 = Sunday
├── meal_type (VARCHAR) — breakfast, lunch, dinner, snack
├── servings (INTEGER) — user might make 2 servings instead of recipe default
```

**Why separate table?**
- Meal plan can have many meals (7 days × 3 meals = 21 meals)
- Same recipe might appear multiple times (Monday & Thursday dinner)
- Normalized structure keeps queries efficient

#### 6. Shopping Lists Table
```
shopping_lists
├── id (UUID, PRIMARY KEY)
├── user_id (UUID, FOREIGN KEY → users.id)
├── meal_plan_id (UUID, FOREIGN KEY → meal_plans.id, nullable)
├── name (VARCHAR)
├── created_at (TIMESTAMP)
├── is_completed (BOOLEAN)
```

#### 7. Shopping List Items Table
```
shopping_list_items
├── id (UUID, PRIMARY KEY)
├── shopping_list_id (UUID, FOREIGN KEY → shopping_lists.id)
├── ingredient_name (VARCHAR)
├── quantity (DECIMAL)
├── unit (VARCHAR)
├── price_estimate (DECIMAL, nullable) — optional, AI could suggest prices
├── is_checked (BOOLEAN) — user marks off as they shop
├── substitute_suggestion (VARCHAR, nullable) — AI suggests "organic lettuce" instead of "regular lettuce"
```

### Key Indexing Strategy

Indexes speed up queries. Build them for columns you filter/search on frequently:

```sql
-- These queries happen often, so index appropriately:

-- "Get all pantry items for user X"
CREATE INDEX idx_pantry_user_id ON pantry_items(user_id);

-- "Get recipes expiring soon"
CREATE INDEX idx_pantry_expiration ON pantry_items(expiration_date) WHERE expiration_date IS NOT NULL;

-- "Get meal plans for user in date range"
CREATE INDEX idx_meal_plans_user_dates ON meal_plans(user_id, start_date, end_date);

-- Foreign keys are auto-indexed in PostgreSQL, but explicit is better for clarity
```

### Relationship Diagram

```
users (1) ──→ (Many) pantry_items
users (1) ──→ (Many) meal_plans (1) ──→ (Many) meal_plan_items (Many) ←── recipes
users (1) ──→ (Many) shopping_lists (1) ──→ (Many) shopping_list_items
```

**Why this structure?**
- Users can have multiple pantries (doesn't apply here, but scalable design)
- One meal plan spans multiple recipes
- One shopping list can combine ingredients from multiple meal plans
- No data duplication; changes to a recipe update everywhere

---

## Backend Architecture

### Why NestJS (or Express)?

**For this project, NestJS is better because:**
- Built-in dependency injection (easier to manage services like AI, database)
- Decorators make code cleaner (less boilerplate than Express)
- Built-in validation (@IsString, @IsEmail, etc.)
- Better for team collaboration (structure is enforced)

**However, Express is fine too — lighter weight, more flexibility**

Let's explain using NestJS concepts (but principles apply to Express):

### Backend Structure

```
backend/
├── src/
│   ├── main.ts                    # Entry point
│   ├── app.module.ts              # Root module
│   │
│   ├── auth/
│   │   ├── auth.controller.ts     # Routes: POST /auth/register, /auth/login
│   │   ├── auth.service.ts        # Business logic: hash password, generate JWT
│   │   ├── jwt.strategy.ts        # Passport.js strategy for JWT validation
│   │   └── auth.guard.ts          # Middleware: checks JWT on protected routes
│   │
│   ├── users/
│   │   ├── users.controller.ts    # Routes: GET /users/profile, PATCH /users/preferences
│   │   ├── users.service.ts       # Database operations on users
│   │   ├── user.entity.ts         # Define User structure (for ORM)
│   │   └── users.module.ts        # Module definition
│   │
│   ├── pantry/
│   │   ├── pantry.controller.ts   # Routes: GET/POST/PATCH/DELETE pantry items
│   │   ├── pantry.service.ts      # Business logic
│   │   ├── pantry.entity.ts       # Database structure
│   │   └── pantry.module.ts
│   │
│   ├── recipes/
│   │   ├── recipes.controller.ts  # Routes: GET /recipes/suggestions
│   │   ├── recipes.service.ts     # Fetches from Spoonacular or generates AI
│   │   ├── ai.service.ts          # Handles Gemini API calls
│   │   └── recipes.module.ts
│   │
│   ├── meal-plans/
│   │   ├── meal-plans.controller.ts
│   │   ├── meal-plans.service.ts  # Orchestrates recipe selection + AI optimization
│   │   ├── meal-plan.entity.ts
│   │   └── meal-plans.module.ts
│   │
│   ├── shopping-list/
│   │   ├── shopping-list.controller.ts
│   │   ├── shopping-list.service.ts  # Deduplicates, suggests alternates
│   │   └── shopping-list.module.ts
│   │
│   ├── common/
│   │   ├── decorators/            # Custom decorators
│   │   │   └── current-user.decorator.ts  # @CurrentUser() to get logged-in user
│   │   ├── filters/               # Exception filters
│   │   └── interceptors/          # Request/response interceptors (e.g., logging)
│   │
│   └── config/
│       ├── database.config.ts     # PostgreSQL connection
│       ├── gemini.config.ts       # Gemini API key & model configuration
│       └── env.ts                 # Environment variables
```

### Example: Pantry Service Logic

**Understanding the flow:**

```typescript
// pantry.service.ts

export class PantryService {
  constructor(
    private readonly prisma: PrismaService, // Database access
    private readonly logger: Logger
  ) {}

  // Add item to pantry
  async addItem(userId: string, createPantryItemDto: CreatePantryItemDto) {
    // 1. Validate input (is quantity positive? valid unit?)
    if (createPantryItemDto.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    // 2. Check if user already has this ingredient
    const existing = await this.prisma.pantryItem.findFirst({
      where: {
        userId,
        ingredient_name: createPantryItemDto.ingredient_name.toLowerCase(), // Case-insensitive
      },
    });

    // 3. Decide: update quantity or create new?
    if (existing) {
      // User already has chicken breast — add to existing quantity
      return this.prisma.pantryItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + createPantryItemDto.quantity,
          updated_at: new Date(),
        },
      });
    } else {
      // New ingredient for this user
      return this.prisma.pantryItem.create({
        data: {
          userId,
          ingredient_name: createPantryItemDto.ingredient_name.toLowerCase(),
          quantity: createPantryItemDto.quantity,
          unit: createPantryItemDto.unit,
          category: await this.categorizeIngredient(createPantryItemDto.ingredient_name),
          expiration_date: createPantryItemDto.expiration_date,
          created_at: new Date(),
        },
      });
    }
  }

  // Helper: Auto-categorize ingredient
  private async categorizeIngredient(name: string): Promise<string> {
    // Could call AI for smart categorization, or use local mapping
    const proteinKeywords = ['chicken', 'beef', 'fish', 'pork', 'tofu'];
    const vegetableKeywords = ['carrot', 'broccoli', 'lettuce', 'spinach'];
    
    if (proteinKeywords.some(keyword => name.includes(keyword))) return 'protein';
    if (vegetableKeywords.some(keyword => name.includes(keyword))) return 'vegetable';
    return 'other';
  }

  // Get expiring items (for dashboard warning)
  async getExpiringItems(userId: string, daysWindow: number = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysWindow);

    return this.prisma.pantryItem.findMany({
      where: {
        userId,
        expiration_date: {
          lte: futureDate, // Less than or equal to future date
          gt: new Date(),  // But after today (not already expired)
        },
      },
      orderBy: { expiration_date: 'asc' },
    });
  }
}
```

**Key concepts explained:**

1. **Dependency Injection**: `PrismaService` is injected — allows testing (swap with mock)
2. **Validation**: Check input before database operation
3. **Error Handling**: Throw appropriate exceptions (BadRequestException, not generic Error)
4. **Deduplication Logic**: When adding "chicken breast", check if user already has it
5. **Case Insensitivity**: Store ingredient names lowercase to prevent "Chicken" vs "chicken" duplicates
6. **Helper Methods**: `categorizeIngredient` can be AI-powered later

### Controller Layer (API Endpoints)

```typescript
// pantry.controller.ts

@Controller('pantry')
@UseGuards(JwtAuthGuard) // All routes require valid JWT
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Post()
  async addItem(
    @CurrentUser() user: any, // Extracted from JWT
    @Body() createPantryItemDto: CreatePantryItemDto,
  ) {
    return this.pantryService.addItem(user.id, createPantryItemDto);
  }

  @Get()
  async getPantry(@CurrentUser() user: any) {
    return this.pantryService.getPantry(user.id);
  }

  @Get('expiring')
  async getExpiringItems(@CurrentUser() user: any) {
    return this.pantryService.getExpiringItems(user.id);
  }

  @Patch(':itemId')
  async updateItem(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
    @Body() updateDto: UpdatePantryItemDto,
  ) {
    return this.pantryService.updateItem(user.id, itemId, updateDto);
  }

  @Delete(':itemId')
  async deleteItem(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
  ) {
    return this.pantryService.deleteItem(user.id, itemId);
  }
}
```

**Why this structure?**

- **Controllers handle HTTP** (routing, parameter extraction)
- **Services handle business logic** (database, calculations, AI calls)
- **Separation** makes testing easier: mock service, test controller independently
- **Guards** enforce authentication before reaching controller
- **CurrentUser** decorator extracts user from JWT (doesn't pollute endpoint code)

---

## AI Integration Strategy

### Understanding Gemini 2.5 Flash API

**Why Gemini 2.5 Flash?**
- No server resources needed (cloud-hosted)
- Excellent quality and speed (Gemini models are state-of-the-art)
- Free tier available (2M input tokens/month, 32K requests/day)
- Fastest inference among top LLMs
- Easy to integrate with Google Cloud ecosystem
- No maintenance burden

**Cost consideration (when free tier exceeded):**
- Gemini 2.5 Flash: $0.075 per 1M input tokens, $0.3 per 1M output tokens
- For meal planning: ~500 input tokens, ~1000 output tokens = ~$0.0006 per request
- User generates 1 meal plan per week = ~$0.002/month per user (negligible)
- Free tier handles most small-to-medium apps comfortably

### Setting Up Gemini API

**Step 1: Get API Key**
1. Go to https://ai.google.dev
2. Click "Get API Key" 
3. Create a new project or use existing
4. Copy your API key
5. Add to `.env`: `GEMINI_API_KEY=AIzaSy...`

**Step 2: Install Client Library**
```bash
npm install @google/generative-ai
```

**Step 3: Basic Usage Example**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const result = await model.generateContent("What's 1+1?");
const response = result.response.text();
console.log(response);
```

**Free Tier Limits** (sufficient for this project):
- 2 million input tokens/month
- 32k requests/day
- Requests per minute: 10 (QPM)
- No credit card required to start

**Important**: Gemini models sometimes wrap JSON in markdown code blocks. Always clean the response before parsing (remove ```json and ``` markers — see example in `ai.service.ts`).

### AI Service Design

```typescript
// ai.service.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private gemini: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Generate recipe suggestions based on available ingredients
   * 
   * Why this approach?
   * - User has [chicken, rice, carrots] but not many other ingredients
   * - Instead of hard-coded rules, AI understands context
   * - AI can suggest recipes using MOST of their items, minimizing shopping
   */
  async suggestRecipes(
    availableIngredients: string[],
    userPreferences: {
      dietaryRestrictions?: string[];
      cookingTimeLimit?: number; // minutes
      calorieTarget?: number;
      cuisinePreferences?: string[];
    },
  ): Promise<RecipeSuggestion[]> {
    const prompt = `
You are a meal planning assistant. A user has the following ingredients available:
${availableIngredients.join(', ')}

User preferences:
- Dietary restrictions: ${userPreferences.dietaryRestrictions?.join(', ') || 'None'}
- Cooking time limit: ${userPreferences.cookingTimeLimit || 'No limit'} minutes
- Preferred cuisines: ${userPreferences.cuisinePreferences?.join(', ') || 'Any'}

Generate 3 recipe suggestions that:
1. Use MOST of the available ingredients (minimize new purchases)
2. Respect dietary restrictions
3. Can be made within the time limit
4. Are realistic and not overly complex

For EACH recipe, respond in this exact JSON format (no markdown):
{
  "name": "Recipe Name",
  "description": "Brief description",
  "prep_time": number,
  "cook_time": number,
  "servings": number,
  "estimated_calories": number,
  "ingredients_have": ["ingredient1", "ingredient2"],
  "ingredients_need": [{"name": "item", "amount": 2, "unit": "cups"}],
  "instructions": "Step-by-step cooking instructions",
  "why_suggested": "Why this recipe fits their pantry"
}

Return ONLY a JSON array, no other text.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const content = result.response.text();
      
      if (!content) throw new Error('Empty response from Gemini');

      // Parse JSON response - Gemini might wrap in markdown, so clean it
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const suggestions = JSON.parse(cleanedContent);
      return suggestions;
    } catch (error) {
      // Log error for debugging, return fallback
      console.error('Gemini API error:', error);
      throw new Error('Failed to generate recipe suggestions');
    }
  }

  /**
   * Generate a full week meal plan optimized for constraints
   * 
   * Why delegate to AI?
   * - Balancing multiple constraints (budget, macros, variety, time) is complex
   * - Hard-coded algorithm would be fragile
   * - AI understands trade-offs naturally
   */
  async generateWeeklyMealPlan(
    recipes: Recipe[],
    userPreferences: {
      dailyCalorieTarget: number;
      mealsPerDay: 'breakfast_lunch_dinner' | 'lunch_dinner' | 'dinner_only';
      budgetLimit: number; // cents
      varietyImportance: 'low' | 'medium' | 'high';
    },
  ): Promise<MealPlan> {
    const recipesList = recipes
      .map(r => `${r.title}: ${r.calories_per_serving} cal, $${(r.estimated_cost / 100).toFixed(2)}`)
      .join('\n');

    const prompt = `
You are optimizing a weekly meal plan with these constraints:
- Daily calorie target: ${userPreferences.dailyCalorieTarget}
- Meals per day: ${userPreferences.mealsPerDay}
- Weekly budget limit: $${(userPreferences.budgetLimit / 100).toFixed(2)}
- Variety importance: ${userPreferences.varietyImportance}

Available recipes:
${recipesList}

Create a 7-day meal plan that:
1. Stays within budget
2. Hits calorie targets (±10% is OK)
3. Respects variety (don't repeat recipes)
4. Maximizes nutritional balance

Return JSON:
{
  "meals": [
    {
      "day": "Monday",
      "breakfast": "recipe_name",
      "lunch": "recipe_name",
      "dinner": "recipe_name",
      "daily_calories": number,
      "daily_cost": number
    },
    ...7 days
  ],
  "total_cost": number,
  "average_daily_calories": number,
  "notes": "Any trade-offs made"
}

Return ONLY valid JSON.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const content = result.response.text();
      
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      return JSON.parse(cleanedContent);
    } catch (error) {
      console.error('Gemini meal plan generation error:', error);
      throw new Error('Failed to generate meal plan');
    }
  }

  /**
   * Optimize shopping list with substitutions
   * 
   * Why AI?
   * - Knows which ingredients are interchangeable (milk alternatives)
   * - Understands seasonal availability
   * - Can suggest budget-friendly swaps
   */
  async optimizeShoppingList(
    items: ShoppingListItem[],
    preferences: { budget: 'tight' | 'flexible'; prefer_seasonal: boolean },
  ): Promise<OptimizedShoppingList> {
    const itemsList = items.map(i => `${i.name}: ${i.quantity} ${i.unit}`).join('\n');

    const prompt = `
A user needs to buy:
${itemsList}

They prefer: ${preferences.budget === 'tight' ? 'Budget-friendly options' : 'Quality over cost'}
Seasonal items: ${preferences.prefer_seasonal ? 'Yes, prefer in-season' : 'No, any time'}

Suggest:
1. Items that can be consolidated (e.g., "onion" and "white onion" → just "onion")
2. Cheaper alternatives that are nearly equivalent
3. Seasonal swaps if applicable

Return JSON:
{
  "consolidated_items": [
    {"name": "item", "quantity": 2, "unit": "cups", "reason": "..."}
  ],
  "suggestions": [
    {
      "original": "item X",
      "substitute": "item Y",
      "reason": "Cheaper by 30%",
      "savings": 1.50
    }
  ],
  "total_estimated_savings": number
}

Return ONLY valid JSON.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const content = result.response.text();
      
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      return JSON.parse(cleanedContent);
    } catch (error) {
      console.error('Gemini shopping list optimization error:', error);
      throw new Error('Failed to optimize shopping list');
    }
  }
}
```

### Critical Mistakes to Avoid

**1. Storing AI responses in database without versioning**
- If AI suggestions change, old stored data becomes stale
- Solution: Store AI suggestions in cache (Redis) with TTL, not permanent database

**2. Not validating AI responses**
- AI can hallucinate or return malformed JSON
- Solution: Always parse and validate response structure before using

```typescript
// Don't do this:
const result = JSON.parse(aiResponse); // If invalid JSON, crashes!

// Do this:
try {
  const result = JSON.parse(aiResponse);
  if (!result.meals || !Array.isArray(result.meals)) {
    throw new Error('Unexpected response structure');
  }
  return result;
} catch (error) {
  throw new InternalServerErrorException('AI service returned invalid data');
}
```

**3. Passing all user data to AI**
- Security risk if sensitive info is included
- Solution: Only pass relevant, non-sensitive data

**4. Not handling API rate limits**
- Gemini has rate limits (2M tokens/month on free tier); too many requests fail
- Solution: Implement exponential backoff, queue requests, cache responses

```typescript
async callGeminiWithRetry(prompt: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await this.model.generateContent(prompt);
    } catch (error) {
      // Check if rate limited (429 error or quota exceeded)
      if ((error.status === 429 || error.message?.includes('quota')) && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

---

## Frontend Architecture

### Why Next.js + React Query?

**Next.js benefits:**
- **SSR (Server-Side Rendering)**: Initial page load is fast (critical for SEO, perceived performance)
- **File-based routing**: `pages/pantry.tsx` → `/pantry` route (no manual routing)
- **API routes**: Backend and frontend in same repo (simpler deployment)
- **Image optimization**: Automatic image compression
- **Built-in CSS/TailwindCSS**: No config needed

**React Query benefits:**
- **Automatic caching**: Request same data twice? Second call is instant
- **Background refetching**: Data stays fresh without user action
- **Optimistic updates**: Update UI immediately, server catches up
- **Request deduplication**: Multiple components want same data? Single request

### Frontend Structure

```
frontend/
├── pages/
│   ├── index.tsx                  # Home/dashboard
│   ├── auth/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── logout.tsx
│   ├── pantry.tsx                 # List & manage pantry items
│   ├── recipes/
│   │   └── suggestions.tsx        # AI recipe suggestions
│   ├── meal-planning.tsx          # Create & manage meal plans
│   └── shopping-list.tsx          # View & manage shopping lists
│
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── ProtectedRoute.tsx     # Wrapper ensuring user is logged in
│   ├── pantry/
│   │   ├── PantryList.tsx         # Display all items
│   │   ├── AddItemForm.tsx
│   │   └── ExpiringItemsAlert.tsx # Warning for soon-to-expire
│   ├── recipes/
│   │   ├── RecipeCard.tsx
│   │   └── RecipeSuggestionLoader.tsx
│   ├── meal-plan/
│   │   ├── MealPlanCalendar.tsx   # Week view
│   │   └── MealSwapper.tsx        # Replace meals
│   ├── shopping-list/
│   │   ├── ShoppingListItem.tsx
│   │   └── OptimizationSuggestions.tsx
│   └── common/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       ├── Loading.tsx
│       └── ErrorBoundary.tsx
│
├── hooks/
│   ├── useAuth.ts                 # Login/logout/current user
│   ├── usePantry.ts               # Fetch/add/update pantry items
│   ├── useRecipeSuggestions.ts    # Request recipe suggestions
│   ├── useMealPlans.ts
│   └── useShoppingList.ts
│
├── api/
│   ├── auth.ts                    # API calls: login, register
│   ├── pantry.ts                  # API calls: CRUD pantry items
│   ├── recipes.ts
│   ├── mealPlans.ts
│   └── shoppingList.ts
│
├── lib/
│   ├── queryClient.ts             # React Query setup
│   ├── axios.ts                   # HTTP client with auth header
│   └── constants.ts               # App constants, URLs
│
└── styles/
    └── globals.css                # TailwindCSS imports
```

### Example: Custom Hook for Pantry

```typescript
// hooks/usePantry.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pantryApi } from '@/api/pantry';

/**
 * Hook to fetch user's pantry items
 * 
 * Benefits:
 * - Automatic caching (fetch once, use multiple places)
 * - Loading/error states built-in
 * - Automatic refetch on window focus
 */
export function usePantry() {
  return useQuery({
    queryKey: ['pantry'], // Unique key for this data
    queryFn: () => pantryApi.getPantry(),
    staleTime: 5 * 60 * 1000, // Treat data as fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to add an item to pantry
 * 
 * Why mutation hook?
 * - Handles loading/success/error states
 * - Can update cache after success (optimistic update)
 * - Integrates with useQuery caching system
 */
export function useAddPantryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: CreatePantryItemDto) => pantryApi.addItem(item),
    onSuccess: (newItem) => {
      // Update cache immediately (optimistic update)
      queryClient.setQueryData(['pantry'], (old: PantryItem[] | undefined) => [
        ...(old || []),
        newItem,
      ]);
    },
    onError: (error) => {
      // Show error notification
      toast.error('Failed to add item');
    },
  });
}

export function useDeletePantryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => pantryApi.deleteItem(itemId),
    onSuccess: (_, itemId) => {
      // Remove from cache
      queryClient.setQueryData(['pantry'], (old: PantryItem[] | undefined) =>
        (old || []).filter(item => item.id !== itemId)
      );
    },
  });
}
```

**Key concepts:**

1. **Query caching**: Same query key → reuses cached data
2. **Mutations**: For create/update/delete operations
3. **Optimistic updates**: UI updates before server confirms
4. **Error handling**: Automatic error states

### Example: Pantry Component

```typescript
// components/pantry/PantryList.tsx

import { usePantry, useDeletePantryItem } from '@/hooks/usePantry';

export function PantryList() {
  const { data: pantryItems, isLoading, error } = usePantry();
  const { mutate: deleteItem } = useDeletePantryItem();

  if (isLoading) return <Loading />;
  if (error) return <Error message={error.message} />;

  return (
    <div className="grid gap-4">
      {pantryItems?.map(item => (
        <div key={item.id} className="flex justify-between items-center p-4 border rounded">
          <div>
            <h3 className="font-semibold">{item.ingredient_name}</h3>
            <p className="text-sm text-gray-600">
              {item.quantity} {item.unit} • Expires: {item.expiration_date}
            </p>
          </div>
          <button
            onClick={() => deleteItem(item.id)}
            className="text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### State Management Philosophy

**Why NOT Redux or Zustand for this app?**

Redux makes sense when:
- State is complex (nested, interdependent)
- Multiple parts of app modify same state
- Time-travel debugging needed

Our app state:
- Mostly server state (pantry, recipes, meal plans — all live in database)
- React Query already handles caching/fetching
- Local UI state is minimal (form inputs, modal open/close)

**Simple rule**: Use React Query for server state, local `useState` for UI state.

```typescript
// ✅ Good
export function RecipeSuggestions() {
  // Server state: managed by React Query
  const { data: suggestions } = useSuggestRecipes();
  
  // UI state: simple useState
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  return (...);
}
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Core app structure, authentication, basic CRUD

**Tasks:**

1. **Setup backend**
   - Initialize NestJS/Express project
   - Setup PostgreSQL database with migrations
   - Setup JWT authentication
   - Create users module

2. **Setup frontend**
   - Initialize Next.js project
   - Setup TailwindCSS
   - Setup React Query and axios client
   - Create authentication pages (login/register)

3. **Test login flow end-to-end**
   - User registers → data stored in database
   - User logs in → receives JWT
   - JWT used for subsequent requests

**Why this first?** Everything else depends on auth. Without it, users aren't isolated.

### Phase 2: Core Features (Weeks 3-4)

**Goal**: Pantry management, basic CRUD

**Backend tasks:**
- Pantry service: add/edit/delete items
- Pantry controller: API endpoints
- Database migrations for pantry table

**Frontend tasks:**
- Pantry page: list items
- Add item form
- Edit/delete functionality
- Expiring items warning

**Why CRUD before AI?** Users need basic functionality first. AI is enhancement.

### Phase 3: Recipe Integration (Weeks 5-6)

**Goal**: AI-powered recipe suggestions, optional Spoonacular integration

**Tasks:**

1. **Decide on recipe database:**
   - Option A: Store recipes locally (schema done in Phase 1)
   - Option B: Use Spoonacular API for real-time recipes
   - Recommended: Start with Option B for variety

2. **Create recipes service:**
   - Fetch recipes from Spoonacular OR stored recipes
   - Call AI service with user's pantry
   - Return suggested recipes

3. **Frontend:**
   - Recipes page with loading state
   - Display suggestions as cards
   - Option to save/favorite recipes

**Important**: Rate-limit AI calls
- Don't call AI every keystroke
- Call only when user explicitly requests (button click)

### Phase 4: Meal Planning (Weeks 7-8)

**Goal**: Weekly meal plan generation and optimization

**Backend:**
- Meal plan service: generate, store, retrieve
- Integration with AI for optimization
- Shopping list generation from meal plan

**Frontend:**
- Calendar view of week with meals
- Ability to swap meals
- Save favorite meal plans for reuse

### Phase 5: Shopping List & Optimization (Weeks 9-10)

**Goal**: Smart shopping list generation and suggestions

**Backend:**
- Shopping list service: create from meal plan
- Deduplication logic
- AI integration for substitution suggestions

**Frontend:**
- Shopping list page
- Checkoff items while shopping
- View optimization suggestions

### Phase 6: Polish & Deploy (Weeks 11+)

- Error handling & validation
- Loading states & skeletons
- Mobile responsiveness
- Deployment (Vercel for frontend, Railway/Render for backend)

---

## Best Practices & Pitfalls

### Backend Best Practices

**1. Validation at Multiple Layers**

```typescript
// ❌ BAD: Only validate in controller
@Post('pantry')
async addItem(@Body() dto: any) { // No validation
  return this.pantryService.addItem(dto);
}

// ✅ GOOD: Validate in DTO and service
@Post('pantry')
async addItem(@Body() dto: CreatePantryItemDto) { // DTO ensures shape
  return this.pantryService.addItem(dto);
}

// In DTO:
export class CreatePantryItemDto {
  @IsString()
  @MinLength(1)
  ingredient_name: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsEnum(['cups', 'grams', 'lbs'])
  unit: string;
}
```

**Why?** Malformed data is caught early, not deep in business logic.

**2. Never Trust User Input**

```typescript
// ❌ BAD: Directly use user input in query
const items = await db.query(`SELECT * FROM pantry WHERE user_id = ${userId}`);
// If userId is manipulated, SQL injection possible

// ✅ GOOD: Use parameterized queries
const items = await db.query('SELECT * FROM pantry WHERE user_id = $1', [userId]);
// Database driver escapes userId automatically
```

**3. Log Strategically, Not Everywhere**

```typescript
// ❌ BAD: Log every operation
this.logger.log('Adding pantry item...');
this.logger.log('Item added successfully');

// ✅ GOOD: Log only notable events
this.logger.warn(`User ${userId} attempted to delete item not in their pantry`);
this.logger.error('Gemini API call failed', { error, userId });
```

**Why?** Too many logs are useless. Focus on errors and security events.

**4. Handle API Errors Consistently**

```typescript
// Create custom exception filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: HttpArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse()['message'];
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

// Use globally
app.useGlobalFilters(new AllExceptionsFilter());
```

### Frontend Best Practices

**1. Always Show Loading States**

```typescript
// ❌ BAD: No feedback while loading
function RecipeSuggestions() {
  const { data } = useRecipeSuggestions();
  return <div>{data?.map(...)}</div>;
}

// ✅ GOOD: Skeleton or spinner
function RecipeSuggestions() {
  const { data, isLoading } = useRecipeSuggestions();
  
  if (isLoading) return <RecipeSkeleton />;
  return <div>{data?.map(...)}</div>;
}
```

**2. Prevent Duplicate Form Submissions**

```typescript
// ❌ BAD: User can click "Save" multiple times
function AddItemForm() {
  const { mutate: addItem } = useAddPantryItem();
  return <button onClick={() => addItem(formData)}>Save</button>;
}

// ✅ GOOD: Disable button while loading
function AddItemForm() {
  const { mutate: addItem, isPending } = useAddPantryItem();
  return (
    <button 
      onClick={() => addItem(formData)}
      disabled={isPending}
    >
      {isPending ? 'Saving...' : 'Save'}
    </button>
  );
}
```

**3. Handle Errors Gracefully**

```typescript
// ❌ BAD: Error crashes app
const result = JSON.parse(response); // If invalid JSON, app crashes

// ✅ GOOD: Catch and display
try {
  const result = JSON.parse(response);
} catch (error) {
  toast.error('Failed to load suggestions. Please try again.');
}
```

**4. Cache Busting Strategy**

```typescript
// ❌ BAD: User adds item, but list shows old data
function usePantry() {
  return useQuery({
    queryKey: ['pantry'],
    queryFn: () => pantryApi.getPantry(),
    // staleTime: Infinity // Never refetch
  });
}

// ✅ GOOD: Data becomes stale after time, auto-refetch
function usePantry() {
  return useQuery({
    queryKey: ['pantry'],
    queryFn: () => pantryApi.getPantry(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Database Best Practices

**1. Migrations, Not Manual Queries**

```bash
# ❌ BAD: Run raw SQL against production
psql -c "ALTER TABLE pantry_items ADD COLUMN category VARCHAR;"

# ✅ GOOD: Use migration tool
npx prisma migrate create add_category_column
# Generates timestamped migration file
# Can be tracked in version control, rolled back if needed
```

**2. Soft Deletes for Audit Trail**

```sql
-- Instead of:
DELETE FROM pantry_items WHERE id = 123;

-- Do:
ALTER TABLE pantry_items ADD COLUMN deleted_at TIMESTAMP;
UPDATE pantry_items SET deleted_at = NOW() WHERE id = 123;

-- Query still works (exclude deleted):
SELECT * FROM pantry_items WHERE deleted_at IS NULL;
```

**Why?** Preserves data for audits, accidental deletion recovery.

### Common Pitfalls

**Pitfall 1: Not Handling Edge Cases**

```typescript
// ❌ BAD: Assumes user always has items
const favoriteItem = pantryItems[0]; // What if array is empty?

// ✅ GOOD: Check edge cases
const favoriteItem = pantryItems?.[0];
if (!favoriteItem) {
  return <EmptyState />;
}
```

**Pitfall 2: AI Responses as Ground Truth**

```typescript
// ❌ BAD: Trust AI 100%
const recipes = await aiService.suggestRecipes(...);
return recipes; // Could contain hallucinated recipes

// ✅ GOOD: Validate before returning
const recipes = await aiService.suggestRecipes(...);
const validRecipes = recipes.filter(r => 
  r.name && r.ingredients && r.instructions
);
return validRecipes;
```

**Pitfall 3: Not Testing Auth Flow**

```typescript
// ❌ BAD: Only test happy path
// User can bypass auth by modifying URL

// ✅ GOOD: Test auth protection
it('should reject request without JWT', async () => {
  const res = await request(app).get('/pantry');
  expect(res.status).toBe(401);
});
```

**Pitfall 4: Not Handling Concurrent Requests**

```typescript
// ❌ BAD: Race condition
const items = await pantryService.getPantry(userId);
const cheapest = Math.min(...items.map(i => i.price));

// Between query and processing, items might change

// ✅ GOOD: Use transactions (if data is critical)
const items = await db.transaction(async (trx) => {
  return trx.select('*').from('pantry_items').where({user_id: userId});
});
```

---

## Deployment Considerations

### Frontend (Next.js on Vercel)

Vercel is optimized for Next.js:
- Auto-deploys on git push
- Edge functions for serverless
- Built-in CDN
- Free tier available

```bash
# Deploy
vercel deploy

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL https://your-api.com
```

### Backend (Express on Railway/Render)

```bash
# Create Procfile
web: node dist/main.js

# Push to GitHub, connect to Railway/Render
# Auto-deploys on push
```

### Database (PostgreSQL on Railway/Render)

- Create managed PostgreSQL instance
- Get connection string (DATABASE_URL)
- Use migrations to initialize schema

### Environment Variables

```bash
# Backend .env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-key-here
GEMINI_API_KEY=AIzaSy...
NODE_ENV=production

# Frontend .env.local
NEXT_PUBLIC_API_URL=https://your-api.com
```

---

## Testing Strategy

### Backend Unit Tests

```typescript
// Test business logic in isolation
describe('PantryService', () => {
  let service: PantryService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { pantryItem: { create: jest.fn() } };
    service = new PantryService(mockDb);
  });

  it('should add pantry item for user', async () => {
    const result = await service.addItem('user123', {
      ingredient_name: 'chicken',
      quantity: 2,
      unit: 'lbs',
    });

    expect(mockDb.pantryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user123',
        ingredient_name: 'chicken',
      }),
    });
  });

  it('should reject negative quantity', async () => {
    expect(
      service.addItem('user123', { quantity: -1 })
    ).rejects.toThrow('Quantity must be positive');
  });
});
```

### Frontend Integration Tests

```typescript
// Test component interactions
describe('AddItemForm', () => {
  it('should add item to pantry', async () => {
    render(<AddItemForm />);

    fireEvent.change(screen.getByLabelText('Ingredient'), {
      target: { value: 'chicken' },
    });
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Item added!')).toBeInTheDocument();
    });
  });
});
```

---

## Summary: Learning Path

**Week 1-2**: Database design, backend setup, authentication
**Week 3-4**: CRUD operations, basic frontend
**Week 5-6**: AI integration for recipes
**Week 7-8**: Meal planning logic
**Week 9-10**: Shopping list optimization
**Week 11+**: Polish, testing, deployment

**Key takeaway**: Build incrementally. Don't try to do everything at once. Each phase is independent; you can deploy after Phase 2 and have a working (if basic) app.

**Resources to keep handy:**
- NestJS docs: https://docs.nestjs.com
- Next.js docs: https://nextjs.org/docs
- React Query docs: https://tanstack.com/query/latest
- Gemini API docs: https://ai.google.dev/docs
- PostgreSQL docs: https://www.postgresql.org/docs

Good luck building! Feel free to revisit concepts as you implement — everything will click when you see it in action.
