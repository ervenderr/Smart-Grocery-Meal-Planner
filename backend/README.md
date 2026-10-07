# Kitcha - Backend API

Express.js + TypeScript backend for the Kitcha application.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v15 or higher)
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

Server will start on http://localhost:3001

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start            # Start production server
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run prisma:studio # Open Prisma Studio (database GUI)
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── env.config.ts    # Environment variables
│   │   └── logger.config.ts # Winston logger setup
│   │
│   ├── middleware/          # Express middleware
│   │   └── errorHandler.ts  # Global error handling
│   │
│   ├── modules/             # Feature modules
│   │   ├── auth/            # Authentication (JWT)
│   │   ├── users/           # User management
│   │   ├── pantry/          # Pantry inventory
│   │   ├── recipes/         # Recipe management
│   │   ├── meal-plans/      # Meal planning
│   │   ├── shopping/        # Shopping lists
│   │   ├── budget/          # Budget tracking
│   │   ├── analytics/       # Dashboard analytics
│   │   └── zapier/          # Zapier automation webhooks
│   │
│   ├── services/            # External services
│   │   └── gemini.service.ts # Gemini API integration
│   │
│   ├── utils/               # Helper functions
│   ├── types/               # TypeScript types
│   ├── app.ts               # Express app setup
│   └── index.ts             # Entry point
│
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Database migrations
│   └── seed.ts              # Database seeding
│
├── tests/                   # Unit & integration tests
├── logs/                    # Log files (production)
├── .env.example             # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🔌 API Endpoints

### Base URL: `http://localhost:3001/api/v1`

### Health Check

```
GET /health
```

### Authentication (Phase 1)

```
POST /api/v1/auth/signup      # Register new user
POST /api/v1/auth/login       # Login user
POST /api/v1/auth/logout      # Logout user
```

### Users (Phase 1)

```
GET    /api/v1/users/profile       # Get user profile
PATCH  /api/v1/users/profile       # Update user profile
PATCH  /api/v1/users/preferences   # Update preferences
```

### Pantry (Phase 2)

```
GET    /api/v1/pantry              # List all pantry items
POST   /api/v1/pantry              # Add item to pantry
GET    /api/v1/pantry/:id          # Get single item
PATCH  /api/v1/pantry/:id          # Update item
DELETE /api/v1/pantry/:id          # Delete item
GET    /api/v1/pantry/expiring-soon # Items expiring in 7 days
```

_More endpoints will be added in subsequent phases..._

### Zapier Integration

```
GET    /api/v1/zapier/events           # List available events
POST   /api/v1/zapier/webhooks         # Register a webhook
GET    /api/v1/zapier/webhooks         # List user's webhooks
DELETE /api/v1/zapier/webhooks/:id     # Delete a webhook
POST   /api/v1/zapier/test/:eventType  # Test a webhook event
```

## 🔗 Zapier Automation

Kitcha integrates with Zapier for workflow automation. Events are dispatched automatically when certain actions occur.

### Supported Events

| Event                   | Trigger                       | Payload                       |
| ----------------------- | ----------------------------- | ----------------------------- |
| `meal_plan_created`     | New meal plan created         | Plan name, dates, meals, cost |
| `item_expiring`         | Pantry item expiring soon     | Item name, days until expiry  |
| `item_expired`          | Pantry item has expired       | Item name, message            |
| `stock_low`             | Item quantity below threshold | Item name, current quantity   |
| `budget_warning`        | 80%+ of weekly budget used    | Budget, spent, percentage     |
| `budget_exceeded`       | Weekly budget exceeded        | Budget, spent, percentage     |
| `shopping_list_created` | New shopping list generated   | List name, item count         |
| `weekly_summary`        | Weekly meal planning summary  | Stats for the week            |

### Setup

1. Add your Zapier webhook URL to `.env`:

   ```env
   ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxxx/xxxxx
   ```

2. Create a Zap in Zapier:
   - Trigger: **Webhooks by Zapier** → **Catch Hook**
   - Copy the webhook URL to your `.env`

3. Configure actions in Zapier (examples):
   - Send email when budget exceeded
   - Add to Google Calendar when meal plan created
   - Send Slack notification for expiring items
   - Create Todoist task for low stock items

### Testing

Use the test endpoint to verify your webhook:

```bash
curl -X POST http://localhost:3001/api/v1/zapier/test/meal_plan_created \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

## 🗄️ Database

### Schema Overview

- **users** - User accounts
- **user_preferences** - User settings (budget, dietary restrictions)
- **pantry_items** - Inventory tracking
- **recipes** - Recipe library
- **meal_plans** - Weekly meal plans
- **meal_plan_items** - Individual meals in plans
- **shopping_lists** - Generated shopping lists
- **shopping_list_items** - Items to buy
- **shopping_history** - Purchase records
- **market_prices** - Gemini API price history
- **alerts** - Budget/expiry alerts

### Prisma Commands

```bash
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open database GUI
npx prisma migrate reset # Reset database (dev only)
```

## 🔒 Authentication

Uses JWT (JSON Web Tokens):

1. User signs up/logs in
2. Server generates JWT token
3. Client stores token (localStorage/cookies)
4. Client includes token in Authorization header
5. Server validates token on protected routes

Token format: `Authorization: Bearer <token>`

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage
```

Tests use Jest + Supertest for API testing.

## 📝 Environment Variables

Required variables (see `.env.example`):

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxxx/xxxxx  # Optional
```

## 🐛 Debugging

### Logs

- Console logs in development
- File logs in production (`logs/` folder)
- Winston handles all logging

### Database Issues

```bash
# View current database
npx prisma studio

# Check migrations status
npx prisma migrate status

# Reset database (caution: deletes data)
npx prisma migrate reset
```

### Common Errors

**"DATABASE_URL is not defined"**

- Copy `.env.example` to `.env`
- Add your PostgreSQL connection string

**"Port 3001 already in use"**

- Change `PORT` in `.env`
- Or kill process: `lsof -ti:3001 | xargs kill`

**"Cannot find module @/config/..."**

- Run `npm install`
- Ensure `tsconfig.json` paths are correct

## 📦 Dependencies

### Core

- **express** - Web framework
- **typescript** - Type safety
- **prisma** - Database ORM
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **node-cron** - Scheduled tasks (Zapier automation)

### Middleware

- **cors** - Cross-origin requests
- **helmet** - Security headers
- **morgan** - HTTP logging
- **express-validator** - Input validation

### Logging & Errors

- **winston** - Structured logging
- **dotenv** - Environment variables

### Development

- **nodemon** - Auto-restart on changes
- **ts-node** - Run TypeScript directly
- **jest** - Testing framework
- **supertest** - API testing

## 🚀 Deployment

### Build for Production

```bash
npm run build
NODE_ENV=production npm start
```

### Deploy to Railway

- Project `kitcha` with two services: `kitcha-api` (this Dockerfile) and `Postgres`.
- Deploys are manual (no GitHub auto-deploy). From `backend/` run:
  `railway up --service kitcha-api --detach`
- Migrations run automatically in `entrypoint.sh` (`prisma migrate deploy` with retry), then node starts as PID 1.
- Healthcheck path: `/health`.
- Never set `PORT`; Railway injects it.
- `DATABASE_URL` is the reference variable `${{Postgres.DATABASE_URL}}`.
- Generate `JWT_SECRET` without echoing it:
  `openssl rand -hex 32 | railway variable set JWT_SECRET --stdin`
- Never run the seed in production (it refuses when `NODE_ENV=production`).
- Keep replicas at 1: the Zapier cron runs in-process.

## 📚 Next Steps

- [x] Phase 1.1: Express setup ✅
- [ ] Phase 1.2: Prisma schema & migrations
- [ ] Phase 1.3: Authentication module
- [ ] Phase 1.4: User management
- [ ] Phase 1.5: Tests

See `IMPLEMENTATION_ROADMAP.md` for full timeline.

## 🤝 Contributing

1. Create feature branch
2. Write tests for new features
3. Ensure tests pass: `npm test`
4. Follow TypeScript strict mode
5. Document all functions with JSDoc

## 📄 License

MIT
