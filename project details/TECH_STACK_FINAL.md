# Kitcha - Final Tech Stack

## ✅ Confirmed Technology Choices

### Backend
- **Framework**: Express.js (v4.18+)
- **Language**: TypeScript (v5+)
- **Database**: PostgreSQL (v15+)
- **ORM**: Prisma (v5+)
- **Authentication**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: express-validator
- **API Testing**: Jest + Supertest
- **Logging**: Winston

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS v3
- **State Management**: React Query (TanStack Query v5)
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation
- **UI Components**: Headless UI + Custom components

### External APIs
- **Pricing API**: Gemini Exchange API (USDTUSD ticker - FREE)
  - Endpoint: `https://api.gemini.com/v1/pubticker/USDTUSD`
  - Purpose: Real-time stablecoin price for budget tracking
  - Cost: FREE (no API key needed for public data)

- **AI Integration**: Google Gemini 2.5 Flash (OPTIONAL - Phase 8+)
  - Purpose: Recipe suggestions, meal planning optimization
  - Cost: FREE tier (2M tokens/month)
  - Endpoint: `@google/generative-ai` package

- **Recipe Database**: Static DB OR Spoonacular API (OPTIONAL)
  - Start with seeded recipes (50-100 static recipes)
  - Can add Spoonacular later if needed

### Database Schema
- **11 Tables**: users, user_preferences, pantry_items, recipes, meal_plans, meal_plan_items, shopping_lists, shopping_list_items, shopping_history, market_prices, alerts
- **Relationships**: Properly normalized with foreign keys
- **Indexing**: Optimized for query performance
- **Migrations**: Prisma migrate

### DevOps & Deployment
- **Frontend Hosting**: Vercel (FREE tier)
- **Backend Hosting**: Render or Railway (FREE tier available)
- **Database Hosting**: Railway PostgreSQL (FREE tier) or Render
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions (optional)
- **Environment**: Docker (optional, for local dev consistency)

### Development Tools
- **Package Manager**: npm or pnpm
- **Code Quality**: ESLint + Prettier
- **Git Hooks**: Husky (optional)
- **API Documentation**: Swagger/OpenAPI (optional)
- **Monorepo Structure**: Separate backend/ and frontend/ folders

## Project Structure

```
Kitcha/
├── backend/                 # Express + TypeScript API
│   ├── src/
│   │   ├── config/         # Database, environment config
│   │   ├── middleware/     # Auth, error handling, logging
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── pantry/
│   │   │   ├── recipes/
│   │   │   ├── meal-plans/
│   │   │   ├── shopping/
│   │   │   ├── budget/
│   │   │   └── analytics/
│   │   ├── services/       # External API services (Gemini)
│   │   ├── utils/          # Helpers
│   │   └── index.ts        # Entry point
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                # Next.js + React
│   ├── app/                # Next.js 14 App Router
│   ├── components/
│   ├── hooks/
│   ├── lib/                # API clients, utils
│   ├── types/
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
│
├── project details/         # Documentation (current)
└── README.md

```

## Why This Stack?

### Express over NestJS
- **Simpler Learning Curve**: Understand every piece of code
- **More Transparent**: No hidden abstractions
- **Faster Development**: Less boilerplate for MVP
- **Industry Standard**: Widely used, huge community
- **Still Professional**: Production-ready architecture

### PostgreSQL over MongoDB
- **Relational Data**: Users → Pantry → Meals → Recipes (clear relationships)
- **Data Integrity**: ACID transactions, foreign keys
- **Complex Queries**: JOINs for analytics (spending trends, etc.)
- **Prisma Support**: Excellent ORM with type safety

### Prisma over TypeORM
- **Better TypeScript**: Auto-generated types
- **Modern API**: Intuitive, clean syntax
- **Migrations**: Easy schema changes
- **Type Safety**: Compile-time checks

### Next.js over Create React App
- **Performance**: Server-side rendering, automatic code splitting
- **SEO-Ready**: Important for web apps
- **File-based Routing**: No react-router setup
- **API Routes**: Can proxy backend calls
- **Production-Ready**: Built-in optimization

### React Query over Redux
- **Server State**: Perfect for API data
- **Auto-Caching**: Reduces API calls
- **Less Boilerplate**: No actions, reducers, sagas
- **Built-in Loading/Error**: Simplifies UI state

## Implementation Order

### Phase 1: Backend Foundation (Week 1-2)
- Express server setup
- PostgreSQL + Prisma schema
- JWT authentication
- User CRUD endpoints

### Phase 2: Core Backend Features (Week 3-4)
- Pantry management (CRUD)
- Recipe management
- Meal planning logic
- Shopping list generation

### Phase 3: Gemini API Integration (Week 5)
- Market price fetching (USDTUSD)
- Budget tracking
- Shopping history with conversions
- Alert system

### Phase 4: Analytics Backend (Week 6)
- Spending trends calculations
- Category breakdowns
- Price comparisons
- Dashboard aggregations

### Phase 5: Frontend Foundation (Week 7-8)
- Next.js setup + auth pages
- Dashboard layout
- API integration with React Query

### Phase 6: Frontend Features (Week 9-10)
- Pantry management UI
- Meal planning calendar
- Shopping list interface
- Budget tracking UI

### Phase 7: Analytics & Charts (Week 11)
- Recharts integration
- Spending trend visualizations
- Category pie charts
- Alert notifications

### Phase 8: Polish & Deploy (Week 12+)
- Error handling
- Loading states
- Mobile responsiveness
- Deployment to Vercel + Render

## Cost Breakdown (FREE Tier)

| Service | Free Tier | Sufficient? |
|---------|-----------|-------------|
| Vercel (Frontend) | 100GB bandwidth | ✅ Yes |
| Render/Railway (Backend) | 750 hours/month | ✅ Yes |
| Railway (PostgreSQL) | 500MB storage | ✅ Yes for MVP |
| Gemini Exchange API | Unlimited (public) | ✅ Yes |
| Google Gemini AI | 2M tokens/month | ✅ Yes (optional feature) |

**Total Cost: $0/month for MVP with reasonable traffic**

## Environment Variables Required

### Backend (.env)
```bash
DATABASE_URL="postgresql://user:password@host:5432/dbname"
JWT_SECRET="your-super-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="development"

# Optional (Phase 8+)
GEMINI_AI_API_KEY="AIzaSy..."
SPOONACULAR_API_KEY="..."
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Success Criteria

After completion, you'll have:
- ✅ Full REST API with 25+ endpoints
- ✅ Complete authentication system
- ✅ Real-time price tracking via Gemini API
- ✅ Interactive dashboard with charts
- ✅ Mobile-responsive UI
- ✅ Deployed and live on internet
- ✅ Professional portfolio piece
- ✅ Comprehensive tests (backend)
- ✅ Complete documentation
- ✅ Ready for interviews

---

**Next Steps**: Proceed with Phase 1 - Backend Foundation
