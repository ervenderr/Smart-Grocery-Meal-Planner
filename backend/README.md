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
│   │   └── analytics/       # Dashboard analytics
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

### Deploy to Render/Railway
1. Connect GitHub repository
2. Set environment variables
3. Set build command: `npm run build`
4. Set start command: `npm start`

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
