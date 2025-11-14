# Kitcha: Complete Project Specification

## Table of Contents
1. [Project Overview](#project-overview)
2. [Core Features Deep Dive](#core-features-deep-dive)
3. [Database Schema & Data Modeling](#database-schema--data-modeling)
4. [API Endpoints Complete Reference](#api-endpoints-complete-reference)
5. [Gemini API Integration Strategy](#gemini-api-integration-strategy)
6. [Frontend Architecture & Pages](#frontend-architecture--pages)
7. [User Workflows & Use Cases](#user-workflows--use-cases)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Technical Decisions & Rationale](#technical-decisions--rationale)
10. [Deployment & DevOps](#deployment--devops)

---

## Project Overview

### Problem Statement

**Current challenges users face:**
- No visibility into grocery spending trends
- Can't easily track what they have vs. what they need
- Difficulty planning meals within budget
- No way to know if they're overspending on groceries
- Price volatility in markets — need benchmarking

### Solution

A full-stack web application that combines:
1. **Pantry Management** — track inventory with expiration dates
2. **Meal Planning** — organize weekly meals
3. **Budget Awareness** — price benchmarking using Gemini stablecoin API
4. **Analytics** — visualize spending trends and patterns
5. **Smart Shopping** — optimized lists with cost insights

### Why Gemini API (Not Recipes)?

**Why stablecoin prices for budgeting?**
- Real-time market data = accurate pricing benchmarks
- "Gemini units" provide a universal reference point (e.g., USDTUSD)
- Users understand: "My groceries cost 50 units today vs 47 last week"
- Enables trend analysis and alerts
- More technically impressive than hardcoded recipes (shows API integration)

**Real-world value:**
- User saves receipts/prices while shopping
- App converts USD prices to Gemini units
- Dashboard shows: "You spent 5% more this week due to inflation/demand"
- Alerts warn: "You've hit 90% of your $100 weekly budget"

### Project Scope (MVP)

**In Scope:**
- User authentication (JWT)
- Pantry CRUD with categories and expiry dates
- Recipe library (static, from database or Spoonacular API)
- Meal plan creation (weekly/daily)
- Shopping list generation from meal plans
- Price tracking via Gemini API (stablecoin prices)
- Budget alerts and thresholds
- Dashboard with spending trends and analytics
- Cost insights and statistics

**Out of Scope (Future Enhancements):**
- AI recipe generation (we're using pricing, not recipes)
- Real-time shopping app integration
- Barcode scanning
- Multi-user households
- Mobile app (web-only MVP)
- Subscription management

---

## Core Features Deep Dive

### Feature 1: User Authentication & Profiles

**What users can do:**
1. Sign up with email and password
2. Log in to existing account
3. Set up profile with preferences
4. Manage account settings
5. Log out

**Backend Logic:**

```
Sign Up Flow:
1. User submits email + password
2. Validate email format (exists only once)
3. Hash password with bcrypt (never store plain text)
4. Create user record in database
5. Generate JWT token
6. Return token to frontend

Login Flow:
1. User submits email + password
2. Find user by email
3. Compare submitted password with bcrypt hash
4. If match: generate JWT token
5. If no match: return 401 error

JWT Token Contains:
- user_id
- email
- issued_at (iat)
- expiration (exp = now + 7 days)
Encoded with SECRET_KEY (backend only knows this)
```

**User Preferences Stored:**
```json
{
  "currency": "USD",
  "budget_per_week": 10000,           // in cents ($100)
  "meals_per_day": 3,                 // breakfast, lunch, dinner
  "dietary_restrictions": ["vegetarian"],
  "alert_threshold_percentage": 90,   // alert at 90% of budget
  "preferred_unit": "kg"              // imperial or metric
}
```

**Why JWT over session cookies?**
- Stateless: No server-side session storage needed
- Scalable: Works across multiple servers
- Mobile-friendly: Can be stored in localStorage
- Flexible: Decoding doesn't require database lookup

---

### Feature 2: Pantry Management

**Core Functionality:**

```
Add Item to Pantry:
1. User enters: name, quantity, unit, category, expiry date
2. System auto-categorizes if needed
3. Store in database
4. Return item with auto-generated ID

Edit Item:
1. User updates quantity, category, or expiry
2. Track "last updated" timestamp
3. Return updated item

Delete Item:
1. Soft delete (mark as deleted) or hard delete
2. Recommendation: soft delete for audit trail

List Pantry:
1. Return all non-deleted items for user
2. Sort by expiry date (urgent items first)
3. Include category grouping
```

**Key Data Points Tracked:**

```
Pantry Item Record:
{
  id: UUID,
  user_id: UUID,
  name: "Chicken Breast",
  quantity: 2,
  unit: "lbs",                    // lbs, kg, grams, pieces, cups, ml
  category: "protein",            // protein, vegetable, fruit, dairy, grains, spices, other
  expiry_date: "2025-11-20",
  purchase_price: 850,            // in cents ($8.50)
  purchase_date: "2025-11-12",
  location: "freezer",            // fridge, freezer, pantry, counter
  notes: "Farm fresh",
  created_at: "2025-11-12T10:00:00Z",
  updated_at: "2025-11-12T10:00:00Z"
}
```

**Why track purchase price?**
- Build personal price database over time
- Compare with Gemini benchmark prices
- Identify if you overpaid
- Helps predict future costs

**Dashboard Displays:**
- Items expiring soon (yellow warning, red critical)
- Breakdown by category (pie chart)
- Most used items (frequency)
- Average cost per category

---

### Feature 3: Recipe Management

**Two Options for Recipe Data:**

**Option A: Static Database (Easier, Recommended for MVP)**
```
Pre-populate recipes table with 50-100 common recipes:
- Spaghetti Carbonara
- Chicken Stir Fry
- Vegetable Soup
- etc.

Each recipe has:
- ID, name, description
- Ingredients (with quantities)
- Prep time, cook time, servings
- Instructions
- Estimated calories
- Estimated cost (calculated from ingredient prices)
```

**Option B: Spoonacular API (More Recipes, Costs Money)**
```
Call Spoonacular API on-demand:
- GET /recipes/search?query=chicken
- Fetch recipe details including ingredients
- Cache results for 24 hours (reduce API calls)
```

**Recommendation: Start with Option A (static), migrate to B if needed**

**Recipe Storage (Option A):**
```
recipes table:
{
  id: UUID,
  title: "Spaghetti Carbonara",
  description: "Classic Italian pasta",
  prep_time: 10,              // minutes
  cook_time: 20,
  servings: 4,
  calories_per_serving: 450,
  ingredients: [              // JSONB for flexibility
    {
      name: "spaghetti",
      amount: 400,
      unit: "grams",
      avg_cost_cents: 150
    },
    {
      name: "eggs",
      amount: 3,
      unit: "pieces",
      avg_cost_cents: 75
    },
    {
      name: "bacon",
      amount: 200,
      unit: "grams",
      avg_cost_cents: 400
    }
  ],
  instructions: "Boil pasta... then mix...",
  created_at: "2025-01-01"
}
```

**Why JSONB for ingredients?**
- Flexible: Different recipes have different ingredient counts
- Queryable: Can search "recipes with chicken"
- Performant: No need for separate ingredients table
- Easy to estimate cost: Sum ingredient costs for recipe total

---

### Feature 4: Meal Planning

**What users do:**
1. Create a meal plan (e.g., "Week of Nov 12")
2. Select meals/recipes for each day
3. Choose meal type (breakfast, lunch, dinner)
4. Specify servings (1 person, 2 people, family)
5. View total cost and nutrition
6. Share or save as template

**Meal Plan Structure:**

```
Meal Plan (Weekly):
  Monday:
    Breakfast: Oatmeal (1 serving)
    Lunch: Chicken Wrap (2 servings)
    Dinner: Spaghetti Carbonara (4 servings)
  Tuesday:
    Breakfast: Eggs & Toast (2 servings)
    Lunch: Leftovers (2 servings)
    Dinner: Stir Fry (4 servings)
  ...
  
Total Nutrition (sum of all meals):
  Calories: 12,000
  Protein: 300g
  Carbs: 1200g
  Fat: 400g

Estimated Total Cost: 105 Gemini units ($105)
```

**Database Schema:**

```
meal_plans:
{
  id: UUID,
  user_id: UUID,
  name: "Week of Nov 12",
  start_date: "2025-11-12",
  end_date: "2025-11-18",
  total_cost_cents: 10500,        // $105
  is_favorite: false,             // can reuse templates
  created_at: "2025-11-12T10:00:00Z"
}

meal_plan_items:
{
  id: UUID,
  meal_plan_id: UUID,
  recipe_id: UUID,
  day_of_week: 1,                 // 0=Monday, 6=Sunday
  meal_type: "breakfast",         // breakfast, lunch, dinner
  servings: 2,
  cost_cents: 800,                // this specific meal's cost
}
```

**Cost Calculation:**

```
For each meal plan item:
  recipe_cost = SUM(ingredients[*].cost) * servings
  
For entire meal plan:
  total_cost = SUM(all meal_plan_items.cost)
```

**Why track `is_favorite`?**
- Users create meal plans they want to reuse
- Saves time: "Use my 'Budget Weekly' template"
- Click "Repeat Last Week" → auto-fills meals

---

### Feature 5: Budget Tracking & Gemini API Integration

**Core Concept:**

Users input grocery prices in USD. Backend converts to "Gemini units" using real-time stablecoin prices.

**Example:**
```
User buys groceries for $50
Backend fetches USDTUSD price: 1.00 (1 USDT = $1 USD)
Converts: $50 → 50 Gemini units
Stores in database

Next week: $48 of groceries
USDTUSD price: 1.01 (slight inflation)
Converts: $48 → ~47.5 Gemini units
Comparison: "Prices went up by 0.5 units this week"
```

**Why Stablecoins?**

- Benchmark for pricing
- Simulates digital currency economy
- More interesting than just "tracking USD prices"
- Real-world relevance (crypto/fintech angle for recruiters)
- Shows API integration skills

**Gemini API Integration:**

```
Endpoint: https://api.gemini.com/v1/pubticker/USDTUSD

Response:
{
  "symbol": "USDTUSD",
  "last": "1.0032",           // Latest price
  "bid": "1.0030",
  "ask": "1.0035",
  "volume": {
    "BTC": 12345.67,
    "USD": 987654.32
  },
  "timestamp": 1605312000000
}

Backend extracts: "last" = 1.0032
Calculation: dollar_amount / last = gemini_units
Example: $100 / 1.0032 = 99.68 Gemini units
```

**Market Prices Table:**

```
market_prices:
{
  id: UUID,
  user_id: UUID,
  symbol: "USDTUSD",
  price: 1.0032,              // as decimal
  timestamp: "2025-11-12T10:00:00Z"
}

This tracks price history for trend analysis
```

**Shopping Receipt Entry:**

```
users_shopping_history:
{
  id: UUID,
  user_id: UUID,
  receipt_date: "2025-11-12",
  total_usd: 10500,           // $105 in cents
  total_gemini_units: 104.5,  // calculated using price on that day
  items_bought: [...],        // which items were bought
  created_at: "2025-11-12T10:00:00Z"
}
```

**Algorithm for Gemini Unit Conversion:**

```typescript
async function convertUSDToGeminiUnits(usdAmount: number): Promise<number> {
  // Fetch latest USDTUSD price
  const geminiPrice = await fetchGeminiPrice('USDTUSD');
  
  // Convert: USD / price = Gemini units
  const geminiUnits = usdAmount / parseFloat(geminiPrice.last);
  
  return geminiUnits;
}

// Store this conversion rate with the transaction
// So we can always see what price was used
```

---

### Feature 6: Budget Alerts

**Alert Types:**

```
1. Weekly Budget Exceeded
   Trigger: total_spent > user.budget_per_week
   Alert: "You've spent 105 units this week (target: 100)"

2. Single Item Over Budget
   Trigger: item_price > user.budget_per_item (optional)
   Alert: "Chicken is 15 units (last week: 12)"

3. Trend Alert
   Trigger: SUM(last 4 weeks) trending up > 10%
   Alert: "Your spending is up 15% compared to last month"

4. Category Overspend
   Trigger: category_spending > category_budget (optional)
   Alert: "Dairy spending is 35 units (budget: 25)"
```

**Alert Storage:**

```
alerts:
{
  id: UUID,
  user_id: UUID,
  alert_type: "budget_exceeded",
  title: "Weekly budget exceeded",
  message: "You've spent 105 units (target: 100)",
  threshold: 10000,           // 100 units in cents
  actual_value: 10500,        // 105 units
  is_read: false,
  created_at: "2025-11-12T10:00:00Z"
}
```

**Alert Thresholds (User Configurable):**

```
user_preferences:
{
  alert_threshold_percentage: 90,     // alert at 90% spent
  alert_enabled: true,
  alert_channels: ["email", "in_app"]
}

// So: if spent > (budget * 0.90), trigger alert
```

---

### Feature 7: Shopping List Generation & Optimization

**How it works:**

```
User creates meal plan for next week:
  - Spaghetti Carbonara (4 servings)
  - Chicken Stir Fry (4 servings)
  - Vegetable Soup (6 servings)

System analyzes required ingredients:
  - Spaghetti: 400g
  - Eggs: 6
  - Bacon: 300g
  - Chicken: 800g
  - Bell Peppers: 3
  - Onions: 2
  - Carrots: 500g
  - Broth: 1L
  - Tomatoes: 4

Checks against current pantry:
  User already has: Tomatoes (4), Onions (1)
  
Generates shopping list:
  - Spaghetti: 400g
  - Eggs: 6
  - Bacon: 300g
  - Chicken: 800g
  - Bell Peppers: 3
  - Onions: 1 (need 2 total, have 1)
  - Carrots: 500g
  - Broth: 1L

Adds cost estimates using Gemini prices:
  - Spaghetti: $1.50 (150 cents)
  - Eggs (6): $1.50
  - Bacon: $4.00
  - Chicken: $8.00
  - Bell Peppers: $2.10
  - Onions: $0.50
  - Carrots: $1.00
  - Broth: $2.50
  
Total: $21.10
Gemini Units (at 1.00 rate): 21.10
```

**Shopping List Database:**

```
shopping_lists:
{
  id: UUID,
  user_id: UUID,
  meal_plan_id: UUID,           // optional: linked to meal plan
  name: "Week of Nov 12",
  total_cost_cents: 2110,
  total_gemini_units: 21.10,
  is_completed: false,
  created_at: "2025-11-12T10:00:00Z"
}

shopping_list_items:
{
  id: UUID,
  shopping_list_id: UUID,
  item_name: "Chicken Breast",
  quantity: 800,
  unit: "g",
  cost_estimate_cents: 800,
  category: "protein",
  is_checked: false,            // user marks off as shopping
  notes: "Buy organic if available"
}
```

**Optimization Logic:**

```
1. Consolidation:
   - "Chicken breast" + "Chicken thighs" → Check if buying 
     both cheaper than one type
   
2. Substitution:
   - Fresh garlic vs pre-minced: Which is cheaper per unit?
   - Suggest alternatives based on Gemini prices
   
3. Seasonal Awareness:
   - Tomatoes expensive in winter? Suggest canned alternative
   - (Can be hardcoded, not AI)

4. Bulk Buying:
   - If recipe needs 3kg flour total, buying 5kg bulk 
     might be cheaper per kg
```

---

### Feature 8: Dashboard & Analytics

**Dashboard Sections:**

#### **1. Quick Stats (Top of Dashboard)**
```
┌─────────────────────────────────────┐
│ Pantry Overview                     │
├─────────────────────────────────────┤
│ Total Items: 24                     │
│ Expiring Soon: 3 items              │
│ Total Pantry Value: 125 units       │
│ Items by Category: [pie chart]      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Budget This Week                    │
├─────────────────────────────────────┤
│ Spent: 95 units / 100 budget        │
│ Remaining: 5 units                  │
│ Status: 95% [████████░] RED         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Current Alerts                      │
├─────────────────────────────────────┤
│ ⚠️  Budget threshold at 90%         │
│ ⚠️  Chicken expiring in 2 days      │
│ ℹ️  Prices up 3% this week          │
└─────────────────────────────────────┘
```

#### **2. Spending Trends (Line Chart)**
```
Chart: Gemini Units Spent Per Week (Last 8 weeks)
Y-axis: Units (0-150)
X-axis: Weeks
Data Points:
  Week 1: 90 units
  Week 2: 92 units
  Week 3: 85 units
  Week 4: 98 units (spike)
  Week 5: 100 units
  Week 6: 95 units
  Week 7: 110 units (current)
  
Trend line shows upward trajectory → Alert!
Average: 95.6 units
```

#### **3. Category Breakdown (Pie Chart)**
```
Spending by Category:
- Protein: 40 units (42%)
- Vegetables: 20 units (21%)
- Dairy: 15 units (16%)
- Grains: 12 units (13%)
- Other: 8 units (8%)

Allows users to identify where money goes
Can drill down into each category for details
```

#### **4. Pantry Inventory Heat Map**
```
Category: Protein
├─ Chicken: 2 lbs (expires Nov 14) [RED - Urgent]
├─ Ground Beef: 1 lb (expires Nov 20) [YELLOW - Soon]
├─ Fish: 0.5 lb (expires Nov 25) [GREEN - OK]

Visual: Color-coded by expiration urgency
Helps prioritize meal planning
```

#### **5. Price Comparison**
```
Chart: Your Price vs Gemini Benchmark
Item: Eggs (per dozen)
Your Avg Price: 2.5 units
Gemini Benchmark: 2.3 units
Difference: +0.2 units (8.7% above)

Helps identify if you overpaid
Can adjust store preferences accordingly
```

#### **6. Meal Plan Summary**
```
Current Meal Plan: "Week of Nov 12"
Days Planned: 7/7 complete
Total Cost: 150 units
Avg Cost Per Day: 21.4 units
Estimated Servings: 20
Cost Per Meal: 7.5 units

Allows users to evaluate if meal plans are affordable
Can compare different meal plans
```

**Analytics Calculations:**

```typescript
// Get spending data for last 8 weeks
async getSpendingTrends(userId: string, weeks = 8) {
  const data = await db.query(`
    SELECT 
      DATE_TRUNC('week', date) as week,
      SUM(total_gemini_units) as units_spent
    FROM shopping_history
    WHERE user_id = $1
      AND date >= NOW() - INTERVAL '${weeks} weeks'
    GROUP BY week
    ORDER BY week
  `);
  return data;
}

// Get average spending
async getAverageSpending(userId: string, weeks = 4) {
  const total = await db.query(`
    SELECT SUM(total_gemini_units) as total
    FROM shopping_history
    WHERE user_id = $1
      AND date >= NOW() - INTERVAL '${weeks} weeks'
  `);
  return total[0].total / weeks;
}

// Get category breakdown
async getCategoryBreakdown(userId: string) {
  const data = await db.query(`
    SELECT 
      category,
      SUM(cost_cents) as total_cost
    FROM pantry_items
    WHERE user_id = $1
    GROUP BY category
  `);
  return data;
}
```

---

## Database Schema & Data Modeling

### Complete ERD (Entity Relationship Diagram)

```
users (1) ──→ (Many) pantry_items
users (1) ──→ (Many) recipes (if user-created)
users (1) ──→ (Many) meal_plans (1) ──→ (Many) meal_plan_items ──→ recipes
users (1) ──→ (Many) shopping_lists (1) ──→ (Many) shopping_list_items
users (1) ──→ (Many) shopping_history
users (1) ──→ (Many) market_prices
users (1) ──→ (Many) alerts
users (1) ──→ (Many) user_preferences (1)
recipes (Many) ──→ (Many) shopping_list_items (join)
```

### Table Definitions

#### **1. users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,  -- bcrypt hash
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  INDEX idx_users_email (email)
);
```

#### **2. user_preferences**
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  
  -- Budget settings
  currency VARCHAR(3) DEFAULT 'USD',
  budget_per_week_cents INT DEFAULT 10000,  -- $100
  
  -- Notification preferences
  alert_enabled BOOLEAN DEFAULT true,
  alert_threshold_percentage INT DEFAULT 90,  -- 0-100
  alert_channels VARCHAR(50)[] DEFAULT ARRAY['in_app'],  -- email, in_app, push
  
  -- Meal planning
  meals_per_day INT DEFAULT 3,  -- breakfast, lunch, dinner
  dietary_restrictions VARCHAR(50)[] DEFAULT ARRAY[],
  
  -- Shopping preferences
  preferred_unit VARCHAR(10) DEFAULT 'kg',  -- kg or lb
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_preferences_user_id (user_id)
);
```

#### **3. pantry_items**
```sql
CREATE TABLE pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Item details
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,  -- lbs, kg, grams, cups, ml, pieces
  category VARCHAR(50) NOT NULL,  -- protein, vegetable, fruit, dairy, grains, spices, other
  
  -- Tracking
  expiry_date DATE,
  purchase_date DATE,
  purchase_price_cents INT,  -- how much user paid
  location VARCHAR(50),  -- fridge, freezer, pantry, counter
  
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,  -- soft delete
  
  INDEX idx_pantry_user_id (user_id),
  INDEX idx_pantry_expiry (expiry_date),
  INDEX idx_pantry_category (category),
  CONSTRAINT chk_quantity_positive CHECK (quantity > 0)
);
```

#### **4. recipes**
```sql
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadata
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Timing & servings
  prep_time_minutes INT DEFAULT 0,
  cook_time_minutes INT DEFAULT 0,
  servings INT DEFAULT 1,
  
  -- Nutrition
  calories_per_serving INT,
  protein_grams DECIMAL(5, 2),
  carbs_grams DECIMAL(5, 2),
  fat_grams DECIMAL(5, 2),
  
  -- Ingredients (JSONB for flexibility)
  ingredients JSONB NOT NULL,  -- array of {name, quantity, unit, cost_cents}
  
  -- Instructions
  instructions TEXT NOT NULL,
  
  -- Source
  source VARCHAR(50),  -- "local" or "spoonacular"
  external_id VARCHAR(255),  -- spoonacular ID if applicable
  
  is_favorite BOOLEAN DEFAULT false,
  estimated_total_cost_cents INT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_recipes_title (title)
);

-- Example ingredients JSONB:
-- [
--   {"name": "spaghetti", "quantity": 400, "unit": "grams", "cost_cents": 150},
--   {"name": "eggs", "quantity": 3, "unit": "pieces", "cost_cents": 75},
--   {"name": "bacon", "quantity": 200, "unit": "grams", "cost_cents": 400}
-- ]
```

#### **5. meal_plans**
```sql
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  total_cost_cents INT,
  total_calories INT,
  
  is_favorite BOOLEAN DEFAULT false,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,  -- soft delete
  
  INDEX idx_meal_plans_user_id (user_id),
  INDEX idx_meal_plans_dates (start_date, end_date),
  CONSTRAINT chk_end_after_start CHECK (end_date >= start_date)
);
```

#### **6. meal_plan_items**
```sql
CREATE TABLE meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id),
  
  day_of_week INT NOT NULL,  -- 0=Monday, 6=Sunday
  meal_type VARCHAR(50) NOT NULL,  -- breakfast, lunch, dinner, snack
  servings INT DEFAULT 1,
  
  cost_cents INT,
  calories INT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_meal_plan_items_meal_plan (meal_plan_id),
  INDEX idx_meal_plan_items_recipe (recipe_id),
  CONSTRAINT chk_day_valid CHECK (day_of_week BETWEEN 0 AND 6)
);
```

#### **7. shopping_lists**
```sql
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  meal_plan_id UUID REFERENCES meal_plans(id),  -- optional: linked to meal plan
  
  name VARCHAR(255) NOT NULL,
  total_cost_cents INT,
  total_gemini_units DECIMAL(10, 2),
  
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  INDEX idx_shopping_lists_user (user_id),
  INDEX idx_shopping_lists_meal_plan (meal_plan_id)
);
```

#### **8. shopping_list_items**
```sql
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  
  cost_estimate_cents INT,
  category VARCHAR(50),
  
  is_checked BOOLEAN DEFAULT false,  -- user marks off while shopping
  actual_cost_cents INT,  -- what user actually paid
  
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_list_items_list (shopping_list_id)
);
```

#### **9. shopping_history**
```sql
CREATE TABLE shopping_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  receipt_date DATE NOT NULL,
  total_usd_cents INT NOT NULL,
  
  -- Gemini conversion info
  gemini_price DECIMAL(10, 4),  -- the USDTUSD price on receipt date
  total_gemini_units DECIMAL(10, 2),
  
  shopping_list_id UUID REFERENCES shopping_lists(id),  -- optional: which list was this
  
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_history_user_date (user_id, receipt_date)
);
```

#### **10. market_prices**
```sql
CREATE TABLE market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  symbol VARCHAR(20) NOT NULL,  -- USDTUSD, etc.
  price DECIMAL(10, 4) NOT NULL,
  bid DECIMAL(10, 4),
  ask DECIMAL(10, 4),
  
  fetched_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_prices_symbol_date (symbol, fetched_at)
);

-- This is global (not per-user) - everyone uses same market data
```

#### **11. alerts**
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  alert_type VARCHAR(50) NOT NULL,  -- budget_exceeded, item_expiring, price_spike, trend_alert
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  threshold INT,  -- what was the threshold
  actual_value INT,  -- what was the actual value
  
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  dismissed_at TIMESTAMP,
  
  INDEX idx_alerts_user (user_id),
  INDEX idx_alerts_unread (user_id, is_read)
);
```

### Key Design Decisions

**Why JSONB for ingredients?**
- Each recipe has different # of ingredients
- No need for separate table
- Queryable: `WHERE ingredients @> '{"name": "chicken"}'`
- Easy to calculate cost: `SUM(ingredients[*].cost)`

**Why soft deletes?**
- Audit trail: know what user had before deletion
- Accidental deletion recovery
- Historical data for analytics
- Use `WHERE deleted_at IS NULL` in queries

**Why separate shopping_history table?**
- Track all purchases over time
- Calculate spending trends
- Compare prices week-to-week
- Calculate average spending

**Why market_prices global (not per-user)?**
- USDTUSD price is the same for everyone
- Single source of truth
- Save storage space
- Can share cached prices across users

---

## API Endpoints Complete Reference

### Authentication Endpoints

#### **POST /api/auth/signup**
Create new user account

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123!"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "created_at": "2025-11-12T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800  // 7 days in seconds
}
```

**Error Cases:**
- 400: Email already exists
- 400: Invalid email format
- 400: Password too weak

**Backend Logic:**
```typescript
async signup(email: string, password: string) {
  // 1. Validate email format
  if (!isValidEmail(email)) throw new Error('Invalid email');
  
  // 2. Check if email exists
  const existingUser = await db.users.findOne({ email });
  if (existingUser) throw new Error('Email already exists');
  
  // 3. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // 4. Create user
  const user = await db.users.create({
    email,
    password_hash: hashedPassword,
    created_at: new Date()
  });
  
  // 5. Generate JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // 6. Create default preferences
  await db.user_preferences.create({
    user_id: user.id
  });
  
  return { user, token, expiresIn: 604800 };
}
```

---

#### **POST /api/auth/login**
User login

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123!"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

**Error Cases:**
- 401: Invalid email or password
- 404: User not found

---

#### **POST /api/auth/logout**
Logout (client-side: delete JWT from localStorage)

**Request:** (Header: Authorization: Bearer {token})
```
No body
```

**Response (200 OK):**
```json
{ "message": "Logged out successfully" }
```

---

### User Endpoints

#### **GET /api/users/profile**
Get current user's profile

**Request:** (Header: Authorization: Bearer {token})

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "avatar_url": "https://...",
  "created_at": "2025-11-12T10:00:00Z",
  "preferences": {
    "budget_per_week": 10000,
    "alert_threshold": 90,
    "dietary_restrictions": ["vegetarian"]
  }
}
```

---

#### **PATCH /api/users/profile**
Update user profile

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "updated_at": "2025-11-12T10:30:00Z"
}
```

---

#### **PATCH /api/users/preferences**
Update user preferences

**Request:**
```json
{
  "budget_per_week": 12000,
  "alert_threshold": 85,
  "dietary_restrictions": ["vegetarian", "gluten-free"],
  "preferred_unit": "lb"
}
```

**Response (200 OK):**
```json
{
  "budget_per_week": 12000,
  "alert_threshold": 85,
  "dietary_restrictions": ["vegetarian", "gluten-free"],
  "preferred_unit": "lb",
  "updated_at": "2025-11-12T10:30:00Z"
}
```

---

### Pantry Endpoints

#### **GET /api/pantry**
List all pantry items for current user

**Query Parameters:**
- `category` (optional): Filter by category
- `expiring_soon` (optional): true = only items expiring in 7 days
- `sort` (optional): "expiry" | "name" | "category" (default: "expiry")

**Request:**
```
GET /api/pantry?category=protein&sort=expiry
```

**Response (200 OK):**
```json
[
  {
    "id": "item-001",
    "name": "Chicken Breast",
    "quantity": 2,
    "unit": "lbs",
    "category": "protein",
    "expiry_date": "2025-11-20",
    "purchase_date": "2025-11-12",
    "purchase_price": 850,
    "location": "freezer",
    "notes": "Farm fresh",
    "days_until_expiry": 8,
    "created_at": "2025-11-12T10:00:00Z"
  },
  ...
]
```

---

#### **POST /api/pantry**
Add item to pantry

**Request:**
```json
{
  "name": "Chicken Breast",
  "quantity": 2,
  "unit": "lbs",
  "category": "protein",
  "expiry_date": "2025-11-20",
  "purchase_price": 850,
  "location": "freezer",
  "notes": "Farm fresh"
}
```

**Response (201 Created):**
```json
{
  "id": "item-001",
  "name": "Chicken Breast",
  "quantity": 2,
  "unit": "lbs",
  "category": "protein",
  "expiry_date": "2025-11-20",
  "purchase_price": 850,
  "location": "freezer",
  "created_at": "2025-11-12T10:00:00Z"
}
```

**Validations:**
- quantity > 0
- unit must be valid (lbs, kg, etc.)
- category must be valid
- expiry_date must be in future

---

#### **PATCH /api/pantry/:itemId**
Update pantry item

**Request:**
```json
{
  "quantity": 1.5,
  "location": "counter",
  "notes": "Thawed for cooking"
}
```

**Response (200 OK):**
```json
{
  "id": "item-001",
  "name": "Chicken Breast",
  "quantity": 1.5,
  "unit": "lbs",
  "location": "counter",
  "notes": "Thawed for cooking",
  "updated_at": "2025-11-12T11:00:00Z"
}
```

---

#### **DELETE /api/pantry/:itemId**
Delete pantry item (soft delete)

**Response (200 OK):**
```json
{ "message": "Item deleted successfully" }
```

---

#### **GET /api/pantry/expiring-soon**
Get items expiring within 7 days

**Response (200 OK):**
```json
[
  {
    "id": "item-001",
    "name": "Chicken Breast",
    "expiry_date": "2025-11-14",
    "days_until_expiry": 2,
    "urgency": "critical"  // critical, warning, ok
  },
  {
    "id": "item-002",
    "name": "Yogurt",
    "expiry_date": "2025-11-18",
    "days_until_expiry": 6,
    "urgency": "warning"
  }
]
```

---

### Recipes Endpoints

#### **GET /api/recipes**
List all recipes (global + user favorites)

**Query Parameters:**
- `search` (optional): Search by title or ingredient
- `category` (optional): Filter by category
- `time_limit` (optional): max cook time in minutes
- `favorite` (optional): true = only favorites

**Request:**
```
GET /api/recipes?search=chicken&time_limit=30
```

**Response (200 OK):**
```json
[
  {
    "id": "recipe-001",
    "title": "Quick Chicken Stir Fry",
    "description": "Easy weeknight dinner",
    "prep_time": 10,
    "cook_time": 15,
    "servings": 4,
    "calories_per_serving": 350,
    "total_cost": 800,
    "ingredients": [
      {"name": "Chicken Breast", "quantity": 800, "unit": "g", "cost": 400},
      {"name": "Bell Pepper", "quantity": 2, "unit": "pieces", "cost": 150},
      {"name": "Soy Sauce", "quantity": 2, "unit": "tbsp", "cost": 50}
    ],
    "instructions": "Heat oil in wok...",
    "is_favorite": false
  },
  ...
]
```

---

#### **GET /api/recipes/:recipeId**
Get single recipe details

**Response (200 OK):**
```json
{
  "id": "recipe-001",
  "title": "Quick Chicken Stir Fry",
  "description": "Easy weeknight dinner",
  "prep_time": 10,
  "cook_time": 15,
  "servings": 4,
  "calories_per_serving": 350,
  "protein_grams": 35,
  "carbs_grams": 20,
  "fat_grams": 15,
  "total_cost": 800,
  "ingredients": [...],
  "instructions": "Heat oil in wok. Add chicken. Cook until done.",
  "is_favorite": false
}
```

---

#### **POST /api/recipes/:recipeId/favorite**
Mark recipe as favorite

**Response (200 OK):**
```json
{
  "id": "recipe-001",
  "title": "Quick Chicken Stir Fry",
  "is_favorite": true
}
```

---

### Meal Plan Endpoints

#### **GET /api/meal-plans**
List all meal plans for current user

**Query Parameters:**
- `start_date` (optional): Filter by date range
- `end_date` (optional)
- `favorites_only` (optional): true = only favorites

**Response (200 OK):**
```json
[
  {
    "id": "plan-001",
    "name": "Week of Nov 12",
    "start_date": "2025-11-12",
    "end_date": "2025-11-18",
    "total_cost": 15000,
    "total_calories": 12000,
    "is_favorite": false,
    "meals_count": 21,
    "created_at": "2025-11-12T10:00:00Z"
  },
  ...
]
```

---

#### **POST /api/meal-plans**
Create new meal plan

**Request:**
```json
{
  "name": "Week of Nov 12",
  "start_date": "2025-11-12",
  "end_date": "2025-11-18",
  "meals": [
    {
      "day": 0,
      "meal_type": "breakfast",
      "recipe_id": "recipe-001",
      "servings": 2
    },
    {
      "day": 0,
      "meal_type": "lunch",
      "recipe_id": "recipe-002",
      "servings": 2
    },
    ...  // 21 meals total for 7 days × 3 meals
  ]
}
```

**Response (201 Created):**
```json
{
  "id": "plan-001",
  "name": "Week of Nov 12",
  "start_date": "2025-11-12",
  "end_date": "2025-11-18",
  "total_cost": 15000,
  "total_calories": 12000,
  "meals": [...],
  "created_at": "2025-11-12T10:00:00Z"
}
```

**Cost Calculation:**
```typescript
total_cost = SUM(
  for each meal:
    recipe.total_cost * servings
)
```

---

#### **GET /api/meal-plans/:planId**
Get specific meal plan details

**Response (200 OK):**
```json
{
  "id": "plan-001",
  "name": "Week of Nov 12",
  "start_date": "2025-11-12",
  "end_date": "2025-11-18",
  "total_cost": 15000,
  "total_calories": 12000,
  "meals": [
    {
      "id": "item-001",
      "day": 0,
      "day_name": "Monday",
      "meal_type": "breakfast",
      "recipe": { id, title, cost, calories, ... },
      "servings": 2,
      "cost": 500,
      "calories": 800
    },
    ...
  ],
  "summary": {
    "avg_daily_cost": 2143,
    "avg_daily_calories": 1714
  }
}
```

---

#### **PATCH /api/meal-plans/:planId**
Update meal plan

**Request:**
```json
{
  "name": "Updated meal plan name",
  "is_favorite": true
}
```

**Response (200 OK):**
```json
{
  "id": "plan-001",
  "name": "Updated meal plan name",
  "is_favorite": true,
  "updated_at": "2025-11-12T11:00:00Z"
}
```

---

#### **DELETE /api/meal-plans/:planId**
Delete meal plan

**Response (200 OK):**
```json
{ "message": "Meal plan deleted successfully" }
```

---

#### **POST /api/meal-plans/:planId/shopping-list**
Generate shopping list from meal plan

**Request:**
```json
{
  "include_pantry": true  // consider current pantry items
}
```

**Response (201 Created):**
```json
{
  "shopping_list_id": "list-001",
  "name": "Shopping List for Week of Nov 12",
  "total_cost": 10500,
  "total_gemini_units": 10.50,
  "items": [
    {
      "name": "Chicken Breast",
      "quantity": 2,
      "unit": "lbs",
      "cost": 1600,
      "category": "protein"
    },
    {
      "name": "Rice",
      "quantity": 2,
      "unit": "lbs",
      "cost": 400,
      "category": "grains"
    },
    ...
  ],
  "created_at": "2025-11-12T10:00:00Z"
}
```

---

### Shopping List Endpoints

#### **GET /api/shopping-lists**
List all shopping lists

**Query Parameters:**
- `completed` (optional): true | false
- `sort` (optional): "recent" | "oldest"

**Response (200 OK):**
```json
[
  {
    "id": "list-001",
    "name": "Week of Nov 12",
    "total_cost": 10500,
    "total_gemini_units": 10.50,
    "is_completed": false,
    "items_count": 15,
    "items_checked": 5,
    "created_at": "2025-11-12T10:00:00Z"
  },
  ...
]
```

---

#### **GET /api/shopping-lists/:listId**
Get shopping list details

**Response (200 OK):**
```json
{
  "id": "list-001",
  "name": "Week of Nov 12",
  "total_cost": 10500,
  "total_gemini_units": 10.50,
  "is_completed": false,
  "items": [
    {
      "id": "item-001",
      "item_name": "Chicken Breast",
      "quantity": 2,
      "unit": "lbs",
      "cost_estimate": 1600,
      "category": "protein",
      "is_checked": false,
      "notes": "Buy organic"
    },
    ...
  ],
  "summary": {
    "items_total": 15,
    "items_checked": 5,
    "progress": 33
  }
}
```

---

#### **PATCH /api/shopping-lists/:listId/items/:itemId**
Mark item as checked/unchecked

**Request:**
```json
{
  "is_checked": true,
  "actual_cost": 1500  // what user actually paid
}
```

**Response (200 OK):**
```json
{
  "id": "item-001",
  "item_name": "Chicken Breast",
  "is_checked": true,
  "actual_cost": 1500,
  "updated_at": "2025-11-12T14:30:00Z"
}
```

---

#### **POST /api/shopping-lists/:listId/complete**
Mark entire shopping list as completed

**Request:**
```json
{
  "total_actual_cost": 10200  // what user actually spent
}
```

**Response (200 OK):**
```json
{
  "id": "list-001",
  "name": "Week of Nov 12",
  "is_completed": true,
  "total_estimated_cost": 10500,
  "total_actual_cost": 10200,
  "savings": 300,
  "completed_at": "2025-11-12T15:00:00Z"
}
```

**Backend Logic:**
```typescript
// Store as shopping_history for analytics
await db.shopping_history.create({
  user_id: userId,
  receipt_date: new Date(),
  total_usd_cents: totalActualCost,
  gemini_price: await getLatestGeminiPrice(),
  total_gemini_units: calculateGeminiUnits(totalActualCost),
  shopping_list_id: listId
});
```

---

### Budget & Pricing Endpoints

#### **GET /api/market-prices/latest**
Get latest Gemini stablecoin prices

**Response (200 OK):**
```json
{
  "symbol": "USDTUSD",
  "price": 1.0032,
  "bid": 1.0030,
  "ask": 1.0035,
  "volume_usd": 987654.32,
  "timestamp": 1605312000000
}
```

**Backend Logic:**
```typescript
async getLatestGeminiPrice() {
  // Check if we have price cached from last 5 minutes
  const cached = await cache.get('gemini_price_USDTUSD');
  if (cached) return cached;
  
  // Otherwise fetch fresh from Gemini API
  const response = await fetch('https://api.gemini.com/v1/pubticker/USDTUSD');
  const data = await response.json();
  
  // Cache for 5 minutes
  await cache.set('gemini_price_USDTUSD', data, { ttl: 300 });
  
  // Store in market_prices table for history
  await db.market_prices.create({
    symbol: 'USDTUSD',
    price: parseFloat(data.last),
    bid: parseFloat(data.bid),
    ask: parseFloat(data.ask),
    fetched_at: new Date()
  });
  
  return data;
}
```

---

#### **GET /api/budget/summary**
Get current week's budget summary

**Response (200 OK):**
```json
{
  "budget_limit": 10000,
  "spent_this_week": 9500,
  "percentage_used": 95,
  "remaining": 500,
  "status": "warning",  // ok, warning, exceeded
  "forecast": {
    "if_current_rate": 13571,  // projection if spending continues
    "trend": "up_5%"
  },
  "gemini_conversion": {
    "price": 1.0032,
    "units_spent": 9.47
  }
}
```

---

#### **GET /api/budget/history**
Get spending history (last 8 weeks)

**Response (200 OK):**
```json
{
  "weeks": [
    {
      "week": "2025-10-15 to 2025-10-21",
      "total_usd": 9200,
      "total_gemini_units": 9.16,
      "avg_daily_rate": 1314,
      "gemini_price_on_receipt": 1.0044
    },
    ...
  ],
  "statistics": {
    "average_weekly_spending": 9543,
    "min_week": 8500,
    "max_week": 10800,
    "trend": "stable"
  }
}
```

---

#### **POST /api/alerts/set-threshold**
Set custom budget alert threshold

**Request:**
```json
{
  "threshold_type": "weekly",
  "threshold_percentage": 85,  // alert at 85% spent
  "enabled": true
}
```

**Response (200 OK):**
```json
{
  "threshold_type": "weekly",
  "threshold_percentage": 85,
  "enabled": true,
  "updated_at": "2025-11-12T10:00:00Z"
}
```

---

#### **GET /api/alerts**
Get all alerts for user

**Query Parameters:**
- `unread_only` (optional): true = only unread
- `alert_type` (optional): Filter by type

**Response (200 OK):**
```json
[
  {
    "id": "alert-001",
    "alert_type": "budget_exceeded",
    "title": "Budget threshold reached",
    "message": "You've spent 85 units this week (target: 100)",
    "threshold": 10000,
    "actual_value": 8500,
    "is_read": false,
    "created_at": "2025-11-12T14:30:00Z"
  },
  {
    "id": "alert-002",
    "alert_type": "item_expiring",
    "title": "Chicken expiring soon",
    "message": "Chicken Breast expires in 2 days",
    "is_read": false,
    "created_at": "2025-11-12T10:00:00Z"
  },
  ...
]
```

---

#### **PATCH /api/alerts/:alertId/read**
Mark alert as read

**Response (200 OK):**
```json
{
  "id": "alert-001",
  "is_read": true,
  "read_at": "2025-11-12T14:35:00Z"
}
```

---

### Analytics Endpoints

#### **GET /api/analytics/dashboard**
Get all dashboard data

**Response (200 OK):**
```json
{
  "pantry_stats": {
    "total_items": 24,
    "expiring_soon": 3,
    "total_value": 12500,
    "by_category": {
      "protein": 5000,
      "vegetable": 2500,
      "dairy": 3000,
      "grains": 2000
    }
  },
  "budget_stats": {
    "weekly_budget": 10000,
    "spent_this_week": 9500,
    "percentage": 95,
    "status": "warning"
  },
  "spending_trend": {
    "weeks": ["2025-10-15", "2025-10-22", ...],
    "amounts": [9200, 9100, 9500, ...],
    "average": 9500,
    "trend": "stable"
  },
  "price_comparison": {
    "your_avg": 2.50,
    "gemini_benchmark": 2.30,
    "difference_percent": 8.7
  },
  "meal_plans": {
    "current": {
      "name": "Week of Nov 12",
      "completion": 40,
      "cost_per_day": 2143
    }
  }
}
```

---

#### **GET /api/analytics/spending-trends**
Get detailed spending trend analysis

**Query Parameters:**
- `weeks` (optional): How many weeks of history (default: 8)
- `group_by` (optional): "week" | "category"

**Response (200 OK):**
```json
{
  "period": "2025-09-15 to 2025-11-12",
  "weeks": [
    {
      "week": "2025-09-15",
      "total_usd": 9200,
      "total_gemini_units": 9.16,
      "average_daily": 1314,
      "categories": {
        "protein": 3500,
        "vegetable": 1200,
        "dairy": 2000,
        "grains": 1500,
        "other": 1000
      }
    },
    ...
  ],
  "analysis": {
    "trend": "up",
    "trend_percentage": 5.2,
    "forecast_next_week": 10200,
    "seasonal_note": "Prices typically up in November"
  }
}
```

---

## Gemini API Integration Strategy

### Why Gemini API for This App?

**Gemini (Gemini Exchange)**
- Provides public ticker data for trading pairs
- Free API with no authentication required for public data
- USDTUSD pair = USDT (stablecoin) priced in USD
- Represents digital currency benchmark

**Why USDTUSD specifically?**
- Universal reference point
- Stable value (approximately $1)
- Real-time market data
- Easy to explain to users: "Cost in Gemini units ≈ cost in USD"

### API Endpoint

```
GET https://api.gemini.com/v1/pubticker/:symbol

Example: https://api.gemini.com/v1/pubticker/USDTUSD

Response:
{
  "symbol": "USDTUSD",
  "last": "1.0032",
  "bid": "1.0030",
  "ask": "1.0035",
  "volume": {
    "BTC": 12345.67,
    "USD": 987654.32
  },
  "timestamp": 1605312000000
}
```

### Implementation

```typescript
// src/services/gemini.service.ts

import axios from 'axios';
import { Logger } from '@nestjs/common';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly GEMINI_API = 'https://api.gemini.com/v1/pubticker';
  private readonly CACHE_TTL = 5 * 60 * 1000;  // 5 minutes
  private priceCache: Map<string, any> = new Map();
  private lastFetch: Map<string, number> = new Map();

  /**
   * Fetch latest USDTUSD price from Gemini API
   * Caches for 5 minutes to reduce API calls
   */
  async getLatestPrice(symbol: string = 'USDTUSD') {
    try {
      const now = Date.now();
      const lastFetchTime = this.lastFetch.get(symbol) || 0;

      // Return cached price if fresh
      if (now - lastFetchTime < this.CACHE_TTL && this.priceCache.has(symbol)) {
        this.logger.debug(`Returning cached price for ${symbol}`);
        return this.priceCache.get(symbol);
      }

      // Fetch fresh price
      this.logger.log(`Fetching latest price for ${symbol}`);
      const response = await axios.get(`${this.GEMINI_API}/${symbol}`);

      const priceData = {
        symbol: response.data.symbol,
        last: parseFloat(response.data.last),
        bid: parseFloat(response.data.bid),
        ask: parseFloat(response.data.ask),
        volume_usd: response.data.volume.USD,
        timestamp: response.data.timestamp,
        fetched_at: new Date()
      };

      // Update cache
      this.priceCache.set(symbol, priceData);
      this.lastFetch.set(symbol, now);

      // Store in database for historical analysis
      await this.storePrice(priceData);

      return priceData;
    } catch (error) {
      this.logger.error(`Failed to fetch ${symbol} price:`, error);
      
      // Fallback to last cached price
      if (this.priceCache.has(symbol)) {
        this.logger.warn(`Using stale cached price for ${symbol}`);
        return this.priceCache.get(symbol);
      }

      // If no cache, use default price (1.00)
      this.logger.warn(`No cache available, using default price 1.00`);
      return {
        symbol,
        last: 1.00,
        bid: 0.9999,
        ask: 1.0001,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Convert USD amount to Gemini units
   */
  async convertUSDToGeminiUnits(usdAmount: number): Promise<number> {
    const priceData = await this.getLatestPrice('USDTUSD');
    return usdAmount / priceData.last;
  }

  /**
   * Store price in database for trend analysis
   */
  private async storePrice(priceData: any) {
    try {
      await this.db.market_prices.create({
        symbol: priceData.symbol,
        price: priceData.last,
        bid: priceData.bid,
        ask: priceData.ask,
        fetched_at: priceData.fetched_at
      });
    } catch (error) {
      this.logger.warn(`Failed to store price in database:`, error);
      // Not critical - continue anyway
    }
  }

  /**
   * Calculate shopping history with Gemini conversion
   */
  async recordShoppingHistory(
    userId: string,
    usdAmount: number,
    items: any[]
  ) {
    const geminiUnits = await this.convertUSDToGeminiUnits(usdAmount);
    const price = await this.getLatestPrice('USDTUSD');

    return this.db.shopping_history.create({
      user_id: userId,
      receipt_date: new Date(),
      total_usd_cents: usdAmount,
      gemini_price: price.last,
      total_gemini_units: geminiUnits,
      items_bought: items
    });
  }

  /**
   * Check if user exceeded budget alert threshold
   */
  async checkBudgetAlert(userId: string): Promise<boolean> {
    const user = await this.db.users.findOne({ id: userId });
    const preferences = await this.db.user_preferences.findOne({ 
      user_id: userId 
    });

    // Get spending this week
    const weekSpending = await this.db.shopping_history.aggregate(`
      SELECT SUM(total_gemini_units) as total
      FROM shopping_history
      WHERE user_id = $1
        AND receipt_date >= DATE_TRUNC('week', NOW())
    `, [userId]);

    const spent = weekSpending[0]?.total || 0;
    const threshold = preferences.budget_per_week_cents / 100;
    const alertThreshold = threshold * (preferences.alert_threshold_percentage / 100);

    if (spent > alertThreshold) {
      // Create alert
      await this.db.alerts.create({
        user_id: userId,
        alert_type: 'budget_exceeded',
        title: 'Budget threshold reached',
        message: `You've spent ${spent.toFixed(2)} units (target: ${threshold})`,
        threshold: threshold,
        actual_value: spent
      });
      return true;
    }

    return false;
  }
}
```

### Error Handling & Caching Strategy

```
API Call Sequence:
1. Check local cache (5-minute TTL)
   ├─ If valid → return cached
   └─ If expired → fetch fresh

2. Call Gemini API
   ├─ Success → cache & store in DB → return
   └─ Failure → check if cache exists
             ├─ If exists → use stale cache (with warning)
             └─ If not → use default (1.00)

This ensures:
- Minimal API calls (only every 5 minutes)
- Always returns a price (never fails)
- Historical data stored for analytics
- Graceful degradation on API outage
```

### Rate Limiting Considerations

```
Gemini Free API:
- No strict rate limit documented
- Recommendation: Cache aggressively
- Store prices in database
- Query DB for historical data, not API

In this app:
- Cache for 5 minutes
- Store every price fetched
- Users query database for history
- Only call API when needed (new price)
```

---

## Frontend Architecture & Pages

### Page Structure

```
pages/
├── index.tsx              # Dashboard
├── login.tsx
├── signup.tsx
├── pantry.tsx             # Pantry management
├── recipes.tsx            # Browse recipes
├── meal-plans/
│   ├── index.tsx          # List meal plans
│   ├── create.tsx         # Create new plan
│   └── [id].tsx           # Edit existing plan
├── shopping-lists/
│   ├── index.tsx          # List shopping lists
│   └── [id].tsx           # View shopping list
├── budget.tsx             # Budget overview
├── analytics.tsx          # Analytics dashboard
└── settings.tsx           # User preferences
```

### Component Architecture

```
components/
├── auth/
│   ├── LoginForm.tsx
│   ├── SignupForm.tsx
│   └── ProtectedRoute.tsx
│
├── pantry/
│   ├── PantryList.tsx
│   ├── PantryItem.tsx
│   ├── AddItemForm.tsx
│   ├── EditItemForm.tsx
│   └── ExpiringAlert.tsx
│
├── recipes/
│   ├── RecipeCard.tsx
│   ├── RecipeDetails.tsx
│   ├── RecipeFilter.tsx
│   └── RecipeSearch.tsx
│
├── meal-plans/
│   ├── MealPlanList.tsx
│   ├── MealPlanCalendar.tsx
│   ├── MealPlanForm.tsx
│   ├── MealDayEditor.tsx
│   └── MealPlanSummary.tsx
│
├── shopping/
│   ├── ShoppingListContainer.tsx
│   ├── ShoppingListItem.tsx
│   ├── ShoppingItemForm.tsx
│   └── CheckoutSummary.tsx
│
├── budget/
│   ├── BudgetSummary.tsx
│   ├── BudgetAlert.tsx
│   └── GeminiUnitConverter.tsx
│
├── analytics/
│   ├── Dashboard.tsx
│   ├── SpendingTrend.tsx
│   ├── CategoryBreakdown.tsx
│   ├── PriceComparison.tsx
│   └── AlertHistory.tsx
│
├── common/
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── LoadingSpinner.tsx
│   ├── ErrorBoundary.tsx
│   └── ConfirmDialog.tsx
│
└── charts/
    ├── LineChart.tsx
    ├── PieChart.tsx
    ├── BarChart.tsx
    └── TrendLine.tsx
```

### Key Features by Page

**1. Dashboard (`index.tsx`)**
- Quick stats cards
- Budget progress bar
- Recent alerts
- Quick actions (Add to pantry, Create meal plan)
- Upcoming expirations
- Spending trend chart

**2. Pantry (`pantry.tsx`)**
- List of all items (sortable, filterable)
- Category filter
- Expiration alert badge
- Quick actions per item (edit, delete, move)
- "Add item" form
- Stats (total items, categories, value)

**3. Recipes (`recipes.tsx`)**
- Search/filter recipes
- Recipe cards with: thumbnail, title, time, cost
- Favorite/unfavorite toggle
- Click to view full details

**4. Meal Plans (`meal-plans/index.tsx`)**
- List of past and current plans
- Create new plan button
- Edit/delete actions
- Quick view: dates, cost, meals count

**5. Create Meal Plan (`meal-plans/create.tsx`)**
- Date picker (start/end)
- Weekly calendar grid (7 days × 3 meals)
- Recipe selector per day/meal type
- Servings adjustment
- Live cost calculation
- Save as favorite checkbox

**6. Shopping List (`shopping-lists/[id].tsx`)**
- Item list with checkboxes
- Cost per item
- Category grouping
- Progress bar (items checked)
- Add item form
- Total cost display
- "Complete" button

**7. Budget (`budget.tsx`)**
- Budget progress (gauge/bar)
- Weekly spending history (line chart)
- Category breakdown (pie chart)
- Price comparison (Gemini benchmark)
- Alert settings
- Trend analysis

**8. Analytics (`analytics.tsx`)**
- Pantry usage over time
- Meal plan completion stats
- Spending patterns
- Seasonal trends
- Most used ingredients
- Favorite recipes

---

## User Workflows & Use Cases

### Use Case 1: Meal Planning for the Week

**Actor**: Home cook, budget-conscious user
**Goal**: Plan meals for the week while staying within $100 budget

**Steps**:
1. Opens "Meal Plans" page
2. Clicks "Create New Plan"
3. Selects dates (Mon-Sun)
4. Browses recipes
5. Selects:
   - Monday: Spaghetti Carbonara (4 servings)
   - Tuesday: Chicken Stir Fry (4 servings)
   - Wednesday: Vegetable Soup (6 servings)
   - etc.
6. System calculates total cost: $95
7. Confirms budget allows it
8. Saves plan (optionally as "Budget Weekly")
9. System generates shopping list
10. Exports to phone/prints for shopping trip

**System Actions**:
- Calculate total cost from recipes
- Convert USD to Gemini units
- Check against user budget
- Generate shopping list (remove duplicates)
- Estimate when pantry items will run out

---

### Use Case 2: Shopping with Price Tracking

**Actor**: Grocery shopper
**Goal**: Buy ingredients for the week and track spending

**Steps**:
1. Goes shopping with app
2. Uses shopping list as checklist
3. Marks items off as they buy them
4. Enters actual prices (if different from estimate)
5. At checkout: enters total receipt amount ($98)
6. App converts to Gemini units: "98 units (at 1.0032 rate)"
7. Compares to estimate: "Saved $2!"
8. Shopping list marked as complete
9. Receipt stored in history

**System Actions**:
- Track which prices were correct
- Update price database for future accuracy
- Calculate if user stayed within budget
- Store receipt for analytics
- Check budget alerts
- Trigger alert if exceeded threshold

---

### Use Case 3: Monitoring Pantry Expiration

**Actor**: Food-conscious user wanting to minimize waste
**Goal**: Use ingredients before they expire

**Steps**:
1. Views dashboard
2. Sees alert: "3 items expiring in 7 days"
3. Clicks alert to see details:
   - Chicken (expires Nov 14) ← URGENT
   - Yogurt (expires Nov 18) ← SOON
   - Milk (expires Nov 22)
4. Creates meal plan for next 3 days featuring chicken
5. Uses remaining items in planned meals
6. Updates pantry as items are used

**System Actions**:
- Calculate expiration urgency (red if < 3 days, yellow if < 7 days)
- Suggest recipes featuring expiring items
- Track what actually gets used
- Analyze waste patterns over time

---

### Use Case 4: Budget Analysis

**Actor**: Financial-conscious user
**Goal**: Understand spending patterns and reduce costs

**Steps**:
1. Views Analytics dashboard
2. Sees spending over last 8 weeks:
   - Week 1: 95 units
   - Week 2: 92 units
   - Week 3: 85 units
   - Week 4: 98 units (spike)
   - Week 5: 100 units
   - Week 6: 110 units (current)
3. Notices upward trend (+15% vs average)
4. Clicks pie chart to see category breakdown
5. Discovers "protein" spending is 45% (highest)
6. Adjusts next week's meal plan to reduce meat usage
7. Sets alert threshold to 85% to get earlier warnings

**System Actions**:
- Aggregate spending data from shopping history
- Calculate trends and forecasts
- Identify categories driving costs
- Suggest optimization strategies
- Store preferences for future alerts

---

## Implementation Roadmap

### Sprint 1: Setup & Authentication (Week 1-2)

**Backend Tasks**:
- Initialize NestJS project
- Setup PostgreSQL
- Create users & preferences tables
- Implement JWT authentication
- Create signup/login endpoints
- Password hashing with bcrypt

**Frontend Tasks**:
- Initialize Next.js project
- Setup TailwindCSS
- Create login page
- Create signup page
- Setup authentication context
- Persist JWT to localStorage

**Testing**:
- Manual: Sign up, login, logout flow
- Verify JWT is stored and used in requests

**Deliverable**: Users can sign up/login

---

### Sprint 2: Pantry Management (Week 3-4)

**Backend Tasks**:
- Create pantry_items table
- CRUD endpoints for pantry
- Categorization logic
- Expiration date tracking
- Filtering/sorting

**Frontend Tasks**:
- Pantry page with list view
- Add item form
- Edit item form
- Delete confirmation
- Category filter
- Sort by expiration

**Database**:
- Seed default categories

**Deliverable**: Full pantry CRUD working

---

### Sprint 3: Recipes & Meal Planning (Week 5-6)

**Backend Tasks**:
- Create recipes table
- Seed 50-100 recipes with costs
- Create meal_plans & meal_plan_items tables
- Meal plan CRUD endpoints
- Cost calculation logic
- Filtering by time/ingredients

**Frontend Tasks**:
- Recipes page with search/filter
- Recipe details modal
- Meal plan creation wizard
- 7-day calendar view
- Drag-drop meal assignment
- Cost preview
- Favorite recipes

**Database**:
- Seed recipes with ingredients & costs

**Deliverable**: Can create weekly meal plans with cost tracking

---

### Sprint 4: Gemini API Integration (Week 7-8)

**Backend Tasks**:
- Create market_prices table
- GeminiService for API calls
- Price caching (5-min TTL)
- USD → Gemini unit conversion
- Store price history
- Error handling & fallbacks

**Frontend Tasks**:
- Display Gemini unit prices
- Price comparison widget
- Budget converter (USD ↔ Gemini units)
- Show price on receipt

**Testing**:
- Manual API calls to Gemini
- Verify caching works
- Test fallback on API failure
- Calculate conversion accurately

**Deliverable**: Prices displayed in Gemini units with real API data

---

### Sprint 5: Shopping List & Budget (Week 9-10)

**Backend Tasks**:
- Create shopping_lists tables
- Generate shopping lists from meal plans
- Deduplication logic
- Cost estimation
- Create alerts table
- Budget alert logic

**Frontend Tasks**:
- Shopping list page
- Checklist functionality
- Item cost input
- Total cost display
- Alert notifications
- Budget progress bar

**Database**:
- Create shopping_history table

**Deliverable**: Complete shopping workflow with budget tracking

---

### Sprint 6: Analytics & Dashboard (Week 11-12)

**Backend Tasks**:
- Analytics endpoints
- Spending trends calculation
- Category breakdown queries
- Price comparison logic
- Forecast algorithm
- Chart data aggregation

**Frontend Tasks**:
- Dashboard page with widgets
- Spending trend line chart
- Category pie chart
- Budget gauge
- Alert history
- Price trend visualization
- Quick stats cards

**Libraries**:
- Recharts for charts

**Deliverable**: Full dashboard with analytics

---

### Sprint 7: Polish & Deployment (Week 13+)

**Backend**:
- Error handling refinement
- Logging & monitoring
- Performance optimization
- Database index tuning
- API documentation

**Frontend**:
- Mobile responsiveness
- Loading states & skeletons
- Error boundaries
- Empty states
- Accessibility (WCAG)
- UI/UX polish

**DevOps**:
- Docker setup
- Environment variables
- CI/CD pipeline
- Deploy to Vercel (frontend)
- Deploy to Render (backend)
- Database migrations

**Deliverable**: Production-ready app deployed

---

## Technical Decisions & Rationale

### Decision 1: PostgreSQL over MongoDB

**Chosen**: PostgreSQL

**Reasoning**:
- Relational data (users → pantry → meal plans)
- JSONB allows flexibility (ingredients array)
- Strong consistency guarantees
- ACID transactions
- Better query performance for complex joins
- Easier to migrate data later if needed

**MongoDB would be better if**:
- Highly unstructured data
- Horizontal scaling required
- Document-per-user model

---

### Decision 2: JWT Authentication over Sessions

**Chosen**: JWT

**Reasoning**:
- Stateless: No server session storage
- Scales easily (multiple servers)
- Mobile-friendly
- Can work with API-first architecture
- Standard for modern web apps

**Sessions would be better if**:
- High-security requirements (e.g., banking)
- Need to revoke instantly
- Sessions are cheaper to store

---

### Decision 3: Static Recipes over AI Generation

**Chosen**: Static database (50-100 recipes initially)

**Reasoning**:
- Simpler implementation
- Predictable costs (no per-request cost)
- Easier to maintain price accuracy
- Can add Spoonacular later if needed
- MVP focus

**AI would be better if**:
- Want unlimited recipe variety
- User engagement priority
- Budget not constrained

---

### Decision 4: Caching Strategy for Gemini Prices

**Chosen**: 5-minute cache with database fallback

**Reasoning**:
- Reduce API calls
- Prices don't change frequently
- Always have historical data
- Graceful degradation on API failure
- Cost-effective

**Real-time updates would be better if**:
- Price volatility high
- User demand for accuracy extreme
- Subscription pricing model

---

### Decision 5: Soft Deletes

**Chosen**: Soft deletes (mark deleted_at) for pantry/meal plans

**Reasoning**:
- Audit trail
- Accidental deletion recovery
- Analytics on all data
- GDPR compliance easier

**Hard deletes would be better if**:
- Storage critical
- User privacy paramount
- No regulatory requirements

---

## Deployment & DevOps

### Frontend Deployment (Vercel)

```bash
# .vercelignore
node_modules/
.env.local
.git/

# Deploy
vercel deploy

# Environment variables
vercel env add NEXT_PUBLIC_API_URL https://api.example.com
vercel env add NEXT_PUBLIC_POSTHOG_KEY pk_...
```

**Vercel Benefits**:
- Auto-deploys on git push
- Edge caching
- Serverless functions
- Free tier available
- Built-in analytics

---

### Backend Deployment (Render or Railway)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

```bash
# Deploy to Render
# 1. Connect GitHub repo
# 2. Set environment variables
# 3. Set build command: npm run build
# 4. Set start command: npm start
```

**Environment Variables**:
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
GEMINI_API_KEY=none (free API)
NODE_ENV=production
API_PORT=3001
```

---

### Database (PostgreSQL on Railway)

```bash
# Create PostgreSQL database on Railway
# Get connection string

# Run migrations
npm run migrate:prod

# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

---

### Monitoring & Logging

```typescript
// Use Winston for logging
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});
```

---

## Summary

This project demonstrates:

✅ **Full-stack capabilities**: Frontend, backend, database, APIs
✅ **Real-world problem solving**: Budget tracking & meal planning
✅ **API integration**: Gemini stablecoin prices for budgeting
✅ **Database design**: Normalized schema with relationships
✅ **Authentication**: JWT-based secure access
✅ **Analytics**: Spending trends and forecasting
✅ **UI/UX**: Dashboard with charts and notifications
✅ **DevOps**: Containerization and deployment

**Recruiter Value**:
- Solves real problem (grocery planning)
- Impressive technical stack
- API integration (Gemini)
- Database design complexity
- Full product polish
- Analytics & insights
- Ready for production

---

**Next Steps**: Begin with Sprint 1 (Auth), build incrementally, deploy after Sprint 2-3.
