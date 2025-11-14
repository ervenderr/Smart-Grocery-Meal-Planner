# Kitcha: Quick Reference & Feature Summary

## 🎯 Project at a Glance

**Problem**: Users waste money, food, and time because they:
- Don't track what they have at home
- Can't plan meals within budget
- Don't see spending patterns
- Miss ingredients expiring

**Solution**: Full-stack web app combining pantry tracking, meal planning, and budget awareness using Gemini stablecoin API for real-time pricing benchmarks.

---

## 📊 Feature Matrix

| Feature | Purpose | Uses API? | Complexity |
|---------|---------|-----------|-----------|
| **User Auth** | Secure access | JWT | Low |
| **Pantry** | Track inventory | None | Low |
| **Recipes** | Browse meal ideas | Optional (Spoonacular) | Low-Med |
| **Meal Plans** | Organize weekly meals | None | Medium |
| **Shopping Lists** | Generate from meal plans | None | Medium |
| **Budget Tracker** | Monitor spending | **Gemini API** | High |
| **Alerts** | Warn on thresholds | None | Low |
| **Analytics** | Visualize trends | None | High |

---

## 🏗️ Core Data Model

```
User
├─ Preferences (budget, dietary, units)
├─ Pantry Items (name, qty, expiry)
├─ Meal Plans (weekly/daily structure)
│  └─ Meal Items (recipes × servings)
├─ Shopping Lists (generated from meals)
│  └─ Shopping Items (checkoff list)
├─ Shopping History (receipts & spending)
├─ Market Prices (Gemini USDTUSD history)
└─ Alerts (budget, expiry, price)

Recipes (shared, not user-specific)
├─ Ingredients (with estimated costs)
├─ Timing & nutrition
└─ Instructions
```

---

## 🔄 Main User Flows

### Flow 1: Weekly Planning
```
1. User creates meal plan (Mon-Sun)
2. Selects 21 meals (7 days × 3 meals/day)
3. System calculates total cost
4. Converts USD → Gemini units (via API)
5. Checks against user budget
6. Generates shopping list
7. Removes duplicates
8. Estimates costs per item
9. User goes shopping with list
10. Marks items as purchased
11. Enters actual total cost
12. System records in shopping_history
13. Calculates if over/under budget
14. Triggers alerts if needed
```

### Flow 2: Price Tracking
```
1. Gemini API returns USDTUSD = 1.0032
2. User spends $100 on groceries
3. Backend converts: $100 / 1.0032 = 99.68 units
4. Stores in shopping_history with price snapshot
5. Next week: price is 1.0048
6. $95 spent → 94.54 units
7. Comparison: 99.68 units → 94.54 units = -5% cheaper
8. Dashboard shows: "Prices up 0.5% this week"
```

### Flow 3: Pantry & Meal Sync
```
1. User adds to pantry: chicken (2 lbs)
2. Creates meal plan using: stir fry (needs 1.5 lbs)
3. App tracks usage: 1.5 lbs used, 0.5 remaining
4. Shopping list doesn't ask for more chicken
5. Next week: if chicken needed but not in pantry
6. App suggests buying
7. User marks as purchased in shopping list
8. Pantry updated from shopping list completion
```

---

## 🔌 API Integration: Gemini

### Why Gemini & Not OpenAI (For Recipes)?

**OpenAI** → Would generate new recipes each time (non-deterministic, pricey)
**Gemini API** → Provides real market data for stablecoin pricing (deterministic, free)

### Gemini Price Endpoint

```
GET https://api.gemini.com/v1/pubticker/USDTUSD

Response:
{
  "last": "1.0032",      ← Use this
  "bid": "1.0030",
  "ask": "1.0035",
  "volume": {...}
}

Calculation:
USD_Amount / last = Gemini_Units
Example: $100 / 1.0032 = 99.68 units
```

### Implementation

```typescript
// src/services/gemini.service.ts

async convertUSDToGeminiUnits(usdAmount: number): Promise<number> {
  const price = await this.getLatestPrice('USDTUSD');
  return usdAmount / price.last;
}

async recordShopping(userId: string, usdSpent: number) {
  const geminiUnits = await this.convertUSDToGeminiUnits(usdSpent);
  const price = await this.getLatestPrice('USDTUSD');
  
  // Store: what user spent, at what price, converted to units
  await db.shopping_history.create({
    user_id: userId,
    total_usd_cents: usdSpent,
    gemini_price: price.last,
    total_gemini_units: geminiUnits,
    date: new Date()
  });
}
```

### Caching Strategy

```
User Action: Create meal plan costing $100
  ↓
Check cache for USDTUSD price
  ├─ If fresh (< 5 min): use cached
  └─ If stale: fetch from Gemini API
       ↓
       Fetch: https://api.gemini.com/v1/pubticker/USDTUSD
         ├─ Success: cache + store in DB
         └─ Failure: use DB backup or default 1.00
       ↓
       Return: $100 / 1.0032 = 99.68 units

Result: User sees "Planning this week: 99.68 Gemini units"
```

---

## 📈 Analytics Calculations

### Spending Trend
```
Week 1: $92 spending    → 92 units
Week 2: $89 spending    → 88 units
Week 3: $98 spending    → 97 units
Week 4: $105 spending   → 104 units ← Alert!

Average: $96 per week
Trend: +5% week-over-week
Forecast (if continues): $110 next week
```

### Category Breakdown
```
Total Pantry Value: $500
├─ Protein: $200 (40%)     ← Highest spend
├─ Vegetables: $120 (24%)
├─ Dairy: $100 (20%)
├─ Grains: $60 (12%)
└─ Other: $20 (4%)

Action: User sees protein is expensive, reduces meat next week
```

### Budget Alert
```
User Budget: $100/week
Alert Threshold: 90% ($90)

As user shops:
$0 → ✅
$50 → ✅
$85 → ✅
$89 → ⚠️ Alert! "At 89% ($1 remaining)"
$95 → 🔴 Alert! "Over by $5"
```

---

## 🗄️ Database Schema Summary

### Key Tables
1. **users** - Email, password hash, created_at
2. **user_preferences** - Budget, dietary, units, alerts
3. **pantry_items** - Inventory with expiry dates
4. **recipes** - Shared recipe library (50-100 seeded)
5. **meal_plans** - Weekly structure
6. **meal_plan_items** - Meals linked to recipes
7. **shopping_lists** - Generated from meal plans
8. **shopping_list_items** - Individual items to buy
9. **shopping_history** - Receipt records with Gemini conversion
10. **market_prices** - USDTUSD price history
11. **alerts** - Budget, expiry, trend alerts

**Key Relationships**:
```
User (1) → (Many) Pantry Items
User (1) → (Many) Meal Plans → (Many) Recipes
User (1) → (Many) Shopping Lists → (Many) Shopping Items
User (1) → (Many) Shopping History (receipts)
All Users ← (Shared) Market Prices ← Gemini API
```

---

## 🎨 Frontend Pages

| Page | URL | Key Components | Purpose |
|------|-----|-----------------|---------|
| Dashboard | `/` | Stats cards, alerts, charts | Overview of all data |
| Login | `/login` | Email, password | Authentication |
| Signup | `/signup` | Email, password, preferences | Account creation |
| Pantry | `/pantry` | List, filter, add, edit | Manage inventory |
| Recipes | `/recipes` | Search, filter, favorites | Browse meal ideas |
| Meal Plans | `/meal-plans` | Calendar, form, preview | Plan weekly meals |
| Shopping | `/shopping-lists/[id]` | Checklist, costs, complete | Shopping trips |
| Budget | `/budget` | Progress, alerts, settings | Track spending |
| Analytics | `/analytics` | Charts, trends, insights | Analyze patterns |
| Settings | `/settings` | Profile, preferences | User configuration |

---

## 🚀 Tech Stack

```
Frontend          Backend              Database       API
├─ Next.js        ├─ Node.js           ├─ PostgreSQL   ├─ Gemini (prices)
├─ React          ├─ NestJS/Express    └─ (optional):  └─ Spoonacular (recipes)
├─ TypeScript     ├─ TypeScript           MongoDB
├─ TailwindCSS    ├─ Prisma/TypeORM
├─ React Query    ├─ JWT Auth
├─ Recharts       ├─ Winston Logging
└─ Axios          └─ Bcrypt

Deployment:
├─ Frontend: Vercel
├─ Backend: Render/Railway
└─ Database: PostgreSQL on Render/Railway
```

---

## 📋 Implementation Phases

| Sprint | Duration | Focus | Key Deliverable |
|--------|----------|-------|-----------------|
| **1** | Wks 1-2 | Auth | Users can sign up/login |
| **2** | Wks 3-4 | Pantry CRUD | Full inventory management |
| **3** | Wks 5-6 | Recipes & Meal Plans | Weekly meal planning |
| **4** | Wks 7-8 | Gemini Integration | Real-time price tracking |
| **5** | Wks 9-10 | Shopping & Budget | Complete shopping workflow |
| **6** | Wks 11-12 | Analytics | Full dashboard & insights |
| **7** | Wks 13+ | Polish & Deploy | Production-ready app |

---

## 🔐 Security Considerations

### Authentication
- ✅ JWT with 7-day expiration
- ✅ Password hashed with bcrypt (10 rounds)
- ✅ HTTPS only (enforced in production)
- ✅ Sensitive endpoints require valid JWT

### Data Protection
- ✅ User data isolated by user_id
- ✅ No PII logged (emails, etc.)
- ✅ Soft deletes for audit trail
- ✅ Parameterized queries (prevent SQL injection)

### API Security
- ✅ Gemini API is public (no auth needed)
- ✅ Rate limited internally (5-min cache)
- ✅ Graceful fallback on API failure
- ✅ Price cache prevents outage impact

---

## 🎓 Learning Outcomes

Building this app teaches:

**Backend**:
- REST API design
- JWT authentication
- Database relationships
- Service layer architecture
- Error handling & logging
- External API integration
- Caching strategies

**Frontend**:
- React component composition
- State management (React Query)
- Form validation
- Chart visualization
- Loading states & skeletons
- Error boundaries
- API integration with axios

**Full-Stack**:
- Database design
- Deployment & DevOps
- Environment management
- Monitoring & logging
- Code organization
- Testing strategies

---

## 💡 Key Technical Highlights

### Why This Project Impresses Recruiters

1. **Full-Stack**: Demonstrates end-to-end capability
2. **Real Problem**: Solves actual user pain point
3. **API Integration**: Uses external Gemini API intelligently
4. **Database Design**: Complex relationships, optimization
5. **Analytics**: Shows data analysis skills
6. **UI/UX**: Polished dashboard with charts
7. **Deployment**: Production-ready DevOps
8. **Budget**: Free tier Gemini API (cost-effective)
9. **Scalability**: Designed for multiple users
10. **Code Quality**: Well-organized, documented code

---

## 📚 Quick Reference: API Endpoints

```
AUTH:
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout

USER:
GET    /api/users/profile
PATCH  /api/users/profile
PATCH  /api/users/preferences

PANTRY:
GET    /api/pantry
POST   /api/pantry
PATCH  /api/pantry/:itemId
DELETE /api/pantry/:itemId
GET    /api/pantry/expiring-soon

RECIPES:
GET    /api/recipes
GET    /api/recipes/:recipeId
POST   /api/recipes/:recipeId/favorite

MEAL PLANS:
GET    /api/meal-plans
POST   /api/meal-plans
GET    /api/meal-plans/:planId
PATCH  /api/meal-plans/:planId
DELETE /api/meal-plans/:planId
POST   /api/meal-plans/:planId/shopping-list

SHOPPING:
GET    /api/shopping-lists
GET    /api/shopping-lists/:listId
PATCH  /api/shopping-lists/:listId/items/:itemId
POST   /api/shopping-lists/:listId/complete

BUDGET & PRICING:
GET    /api/market-prices/latest
GET    /api/budget/summary
GET    /api/budget/history
POST   /api/alerts/set-threshold
GET    /api/alerts
PATCH  /api/alerts/:alertId/read

ANALYTICS:
GET    /api/analytics/dashboard
GET    /api/analytics/spending-trends
```

---

## 🎯 Success Metrics

After completing this project, you'll have:

✅ Full working app deployed and live
✅ Portfolio piece demonstrating full-stack skills
✅ Real Gemini API integration working
✅ Database with optimized queries
✅ Production-grade error handling
✅ Responsive UI with charts/analytics
✅ Authentication system
✅ Comprehensive documentation
✅ Deploy pipeline configured
✅ Ready for recruiter/interview discussions

---

## 🔗 Resources

**Documentation**:
- Main Guide: `Smart_Grocery_Meal_Planner_Guide.md` (Gemini concepts)
- Complete Spec: `SMART_GROCERY_MEAL_PLANNER_COMPLETE_SPEC.md` (All features)
- This File: Quick reference

**External Links**:
- Gemini API: https://api.gemini.com/v1/pubticker/USDTUSD
- NestJS: https://docs.nestjs.com
- Next.js: https://nextjs.org/docs
- React Query: https://tanstack.com/query/latest
- PostgreSQL: https://www.postgresql.org/docs

---

## 🚦 Getting Started

**Day 1-2**: Read complete spec
**Day 3-4**: Setup backend & database
**Day 5-6**: Implement authentication
**Day 7-14**: Build core features (pantry, recipes, meals)
**Day 15-16**: Integrate Gemini API
**Day 17+**: Polish & deploy

**Timeline**: 3-4 weeks for MVP, 6-8 weeks for polish

---

**Next Steps**: Start with Sprint 1 (Authentication) in the complete specification document.
