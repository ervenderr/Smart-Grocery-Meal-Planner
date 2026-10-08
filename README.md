# 🍳 Kitcha - Smart Grocery & Meal Planner

<div align="center">

![Kitcha Dashboard](./image.png)

**A full-stack, AI-powered grocery and meal planning application built with modern technologies**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black.svg)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg)](https://www.prisma.io/)
[![AI Powered](https://img.shields.io/badge/AI-Google%20Gemini-orange.svg)](https://ai.google.dev/)

[Features](#-key-features) • [Tech Stack](#-technology-stack) • [Architecture](#-system-architecture) • [Installation](#-installation) • [API Documentation](#-api-documentation)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [Installation](#-installation)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Security Features](#-security-features)
- [AI Integration](#-ai-integration)
- [Performance Optimizations](#-performance-optimizations)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**Kitcha** is a comprehensive, enterprise-grade grocery and meal planning application that helps users manage their pantry inventory, plan meals, track budgets, and reduce food waste. The application leverages AI technology to provide intelligent recipe suggestions, automated meal planning, and budget-friendly ingredient substitutions.

### Problem Statement
- **Food Waste**: 40% of food in households goes to waste due to poor planning
- **Budget Management**: Families struggle to track grocery spending effectively
- **Meal Planning**: Creating weekly meal plans is time-consuming and complex
- **Inventory Tracking**: Users lose track of pantry items and expiration dates

### Our Solution
Kitcha provides an all-in-one platform that:
- ✅ Tracks pantry inventory with expiration date monitoring
- ✅ Generates AI-powered meal plans based on available ingredients
- ✅ Provides real-time budget tracking and spending analytics
- ✅ Sends smart notifications for expiring items and budget warnings
- ✅ Suggests cost-effective ingredient substitutions
- ✅ Creates automated shopping lists from meal plans

---

## ✨ Key Features

### 🏠 Pantry Management
- **Inventory Tracking**: Comprehensive pantry item management with categories, quantities, and units
- **Expiration Monitoring**: Automatic tracking of expiration dates with color-coded warnings
- **Smart Search**: Quick search and filter by category, location, or name
- **Barcode Scanning**: *(Coming soon)* Scan products to add instantly

### 🍽️ Recipe Management
- **Recipe Database**: Store unlimited personal recipes with ingredients and instructions
- **Nutritional Information**: Track calories, prep time, cook time, and servings
- **Dietary Restrictions**: Filter by vegetarian, vegan, gluten-free, dairy-free, nut-free, halal, kosher
- **Public Sharing**: Share recipes with the community
- **Favorites System**: Quick access to frequently used recipes

### 📅 Meal Planning
- **Weekly Planner**: Visual calendar interface for planning meals
- **Drag & Drop**: Intuitive meal assignment to days and meal types
- **Cost Estimation**: Automatic calculation of meal plan costs
- **Shopping List Generation**: One-click creation of shopping lists from meal plans
- **Meal History**: Track what you've cooked and when

### 🛒 Shopping Lists
- **Smart Generation**: Auto-create lists from meal plans
- **Item Grouping**: Organize by category for efficient shopping
- **Price Tracking**: Monitor costs and compare with estimates
- **Checklist Mode**: Check off items while shopping
- **Multi-List Support**: Manage multiple shopping lists simultaneously

### 💰 Budget Tracking
- **Weekly Budget**: Set and monitor weekly spending limits
- **Real-time Alerts**: Get notified at 80% and 100% budget usage
- **Spending Analytics**: Visual charts and breakdowns by category
- **Historical Trends**: Track spending patterns over time
- **Savings Insights**: Identify opportunities to reduce costs

### 🔔 Smart Notifications
- **Expiration Alerts**: Get notified 7, 3, and 1 day before items expire
- **Budget Warnings**: Automatic alerts when approaching or exceeding budget
- **Custom Reminders**: Set meal prep and shopping day reminders
- **Priority Levels**: Urgent, high, normal, and low priority notifications
- **Action Links**: One-tap navigation to relevant sections

### 🤖 AI-Powered Features
- **Recipe Suggestions**: AI analyzes pantry items and suggests recipes
- **Meal Plan Generation**: Create complete weekly meal plans with AI
- **Ingredient Substitution**: Get budget-friendly alternatives for expensive ingredients
- **Dietary Preference Learning**: AI adapts to your food preferences over time
- **Smart Recommendations**: Personalized suggestions based on usage patterns

### 📊 Analytics Dashboard
- **Spending Overview**: Visual charts of monthly/weekly spending
- **Category Breakdown**: See where your money goes
- **Budget Status**: Real-time progress indicators
- **Savings Opportunities**: AI-identified cost-saving tips
- **Usage Statistics**: Track pantry turnover and recipe usage

---

## 🛠️ Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.0.2 | React framework with SSR and routing |
| **TypeScript** | 5.0+ | Type-safe JavaScript superset |
| **Tailwind CSS** | 3.4+ | Utility-first CSS framework |
| **React Hook Form** | 7.x | Performant form handling |
| **Zod** | 3.x | Schema validation |
| **Zustand** | 4.x | Lightweight state management |
| **Axios** | 1.x | HTTP client with interceptors |
| **date-fns** | 3.x | Date manipulation library |
| **Lucide React** | Latest | Beautiful icon library |
| **React Hot Toast** | 2.x | Toast notifications |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 20.x | JavaScript runtime |
| **Express** | 4.x | Web application framework |
| **TypeScript** | 5.0+ | Type-safe JavaScript |
| **Prisma** | 5.22.0 | Modern ORM with type safety |
| **PostgreSQL** | 15+ | Relational database |
| **JWT** | Latest | Authentication tokens |
| **bcrypt** | Latest | Password hashing |
| **Helmet** | Latest | Security middleware |
| **CORS** | Latest | Cross-origin resource sharing |
| **Winston** | 3.x | Advanced logging |
| **express-validator** | 7.x | Request validation |
| **express-rate-limit** | 7.x | API rate limiting |

### AI & External Services
| Service | Purpose |
|---------|---------|
| **Google Gemini AI** | Recipe suggestions, meal planning, ingredient substitution |
| **Docker** | Containerization for consistent environments |
| **Docker Compose** | Multi-container orchestration |

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Next.js    │  │  TypeScript  │  │  Tailwind    │      │
│  │   Frontend   │  │   Components │  │     CSS      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express.js Server (Node.js + TypeScript)           │   │
│  │  • Rate Limiting  • CORS  • Helmet Security         │   │
│  │  • JWT Auth       • Request Validation              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────┐
│  Business Logic  │ │ AI Service  │ │ Notification │
│      Layer       │ │   Layer     │ │    Service   │
│                  │ │             │ │              │
│ • Auth Service   │ │ • Gemini AI │ │ • Generator  │
│ • Pantry Service │ │ • Recipe AI │ │ • Scheduler  │
│ • Recipe Service │ │ • Meal AI   │ │ • Delivery   │
│ • Budget Service │ │ • Substit.  │ │              │
└──────────────────┘ └─────────────┘ └──────────────┘
            │               │               │
            └───────────────┼───────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Access Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Prisma ORM (Type-Safe Queries)            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                PostgreSQL Database                   │   │
│  │  • Users          • Recipes        • Notifications   │   │
│  │  • Pantry Items   • Meal Plans     • Alerts          │   │
│  │  • Shopping Lists • Analytics      • Audit Logs      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow Example

```
User Action: "Generate AI Meal Plan"
    │
    ▼
Frontend (Next.js)
    │ 1. User fills form with preferences
    │ 2. Validates input with Zod schema
    │ 3. Sends POST request with JWT token
    ▼
API Gateway (Express)
    │ 4. Rate limiter checks request count
    │ 5. JWT middleware validates token
    │ 6. express-validator checks request body
    ▼
AI Controller
    │ 7. Extracts user ID from token
    │ 8. Calls AI Service with parameters
    ▼
AI Service
    │ 9. Fetches user's pantry items from DB
    │ 10. Constructs prompt for Gemini AI
    │ 11. Sends request to Google Gemini API
    │ 12. Parses AI response
    │ 13. Normalizes ingredient units
    ▼
Meal Plan Service
    │ 14. Creates recipes in database
    │ 15. Creates meal plan record
    │ 16. Links recipes to meal plan
    ▼
Response
    │ 17. Returns meal plan to frontend
    │ 18. Frontend displays results
    │ 19. User sees generated meal plan
```

---

## 🚀 Installation

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js**: Version 20.x or higher ([Download](https://nodejs.org/))
- **npm**: Version 10.x or higher (comes with Node.js)
- **PostgreSQL**: Version 15 or higher ([Download](https://www.postgresql.org/download/))
- **Git**: Latest version ([Download](https://git-scm.com/))
- **AI provider API key**: any OpenAI-compatible provider (default: Dahl Inference, MiniMax M2.7)

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/smart-grocery-meal-planner.git
cd smart-grocery-meal-planner
```

### Step 2: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure environment variables
nano .env
```

**Backend Environment Variables:**

```env
# Server Configuration
PORT=3001
NODE_ENV=development
API_VERSION=v1

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/smart_grocery_db"

# JWT Configuration
JWT_SECRET="your-super-secure-jwt-secret-minimum-32-characters-long"
JWT_EXPIRY="7d"

# AI provider (any OpenAI-compatible endpoint works by changing these env vars)
AI_PROVIDER="dahl"
AI_BASE_URL="https://inference.dahl.global/v1"
AI_MODEL="MiniMaxAI/MiniMax-M2.7"
# AI_API_KEY is a secret: set it only as a Railway variable, never commit it
# Optional: USDA_API_KEY (nutrition), OFF_CONTACT (Open Food Facts User-Agent contact)

# CORS Configuration
FRONTEND_URL="http://localhost:3000"
FRONTEND_URL_STAGING="https://staging.yourdomain.com"

# Security
BCRYPT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

```bash
# Generate a strong JWT secret
openssl rand -base64 48

# Run database migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed

# Start development server
npm run dev

# Server should be running on http://localhost:3001
```

### Step 3: Frontend Setup

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local

# Configure environment variables
nano .env.local
```

**Frontend Environment Variables:**

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# App Configuration
NEXT_PUBLIC_APP_NAME="Kitcha"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

```bash
# Start development server
npm run dev

# Application should be running on http://localhost:3000
```

### Step 4: Docker Setup (Alternative)

If you prefer using Docker:

```bash
# From project root directory
docker-compose up -d

# This will start:
# - PostgreSQL database on port 5432
# - Backend server on port 3001
# - Frontend server on port 3000

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Step 5: Verify Installation

1. **Backend Health Check**: Visit `http://localhost:3001/health`
   - Should return: `{"status": "ok", "timestamp": "...", "environment": "development"}`

2. **Frontend**: Visit `http://localhost:3000`
   - Should see the login page

3. **Create Test Account**:
   ```bash
   # Using the signup endpoint
   curl -X POST http://localhost:3001/api/v1/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Test123!@#",
       "firstName": "Test",
       "lastName": "User"
     }'
   ```

---

## 📚 API Documentation

### Base URL
```
Development: http://localhost:3001/api/v1
Production: https://api.kitcha.com/api/v1
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### Authentication
- `POST /auth/signup` - Create new account
- `POST /auth/login` - Login and receive JWT token
- `POST /auth/logout` - Logout (invalidate token)

#### Pantry Management
- `GET /pantry` - Get all pantry items
- `POST /pantry` - Add new pantry item
- `GET /pantry/:id` - Get single pantry item
- `PATCH /pantry/:id` - Update pantry item
- `DELETE /pantry/:id` - Delete pantry item
- `GET /pantry/expiring-soon` - Get items expiring within N days

#### Recipes
- `GET /recipes` - Get all recipes
- `POST /recipes` - Create new recipe
- `GET /recipes/:id` - Get single recipe
- `PATCH /recipes/:id` - Update recipe
- `DELETE /recipes/:id` - Delete recipe
- `PATCH /recipes/:id/favorite` - Toggle favorite status

#### Meal Plans
- `GET /mealplans` - Get all meal plans
- `POST /mealplans` - Create new meal plan
- `POST /mealplans/from-ai` - Create from AI-generated plan
- `GET /mealplans/:id` - Get single meal plan
- `PATCH /mealplans/:id` - Update meal plan
- `DELETE /mealplans/:id` - Delete meal plan

#### AI Features (Rate Limited: 10/hour)
- `POST /ai/suggest-recipes` - Get AI recipe suggestions
- `POST /ai/generate-meal-plan` - Generate weekly meal plan
- `POST /ai/suggest-substitutions` - Get ingredient substitutions

#### Notifications
- `GET /notifications` - Get all notifications
- `GET /notifications/stats` - Get notification statistics
- `POST /notifications/generate` - Generate automatic notifications
- `PATCH /notifications/:id/read` - Mark as read
- `POST /notifications/read-all` - Mark all as read
- `PATCH /notifications/:id/dismiss` - Dismiss notification
- `DELETE /notifications/:id` - Delete notification

#### Analytics
- `GET /analytics/dashboard` - Get dashboard analytics
- `GET /analytics/spending-trends` - Get spending trends

For detailed request/response examples, see the [API Documentation](./docs/API.md) file.

---

## 🗄️ Database Schema

### Key Entities

```mermaid
erDiagram
    USERS ||--o{ PANTRY_ITEMS : owns
    USERS ||--o{ RECIPES : creates
    USERS ||--o{ MEAL_PLANS : plans
    USERS ||--o{ NOTIFICATIONS : receives
    MEAL_PLANS ||--o{ MEAL_PLAN_ITEMS : contains
    RECIPES ||--o{ MEAL_PLAN_ITEMS : includes
    MEAL_PLANS ||--o{ SHOPPING_LISTS : generates
```

### Database Statistics
- **Total Tables**: 11
- **Total Indexes**: 25+
- **Relationships**: 15+
- **Estimated Size**: 50MB (1000 users)

---

## 🔒 Security Features

### Authentication & Authorization
✅ **JWT Tokens** with 7-day expiry
✅ **Bcrypt Password Hashing** (10 rounds)
✅ **Account Lockout** after 5 failed attempts
✅ **Token Validation** on every request

### API Security
✅ **Rate Limiting**: 100 req/15min (general), 5 req/15min (auth), 10 req/hour (AI)
✅ **CORS**: Whitelist-based origin control
✅ **Helmet.js**: Security headers (CSP, HSTS, XSS)
✅ **Input Validation**: express-validator on all endpoints
✅ **SQL Injection Protection**: Prisma parameterized queries

### Data Protection
✅ **HTTPS Enforced** in production
✅ **Sensitive Data Sanitization** in logs
✅ **Environment Variables** for secrets
✅ **Database Backups** automated daily

---

## 🤖 AI Integration

### Features Powered by Google Gemini AI

1. **Recipe Suggestions** - Analyzes pantry inventory and generates 3-5 personalized recipes
2. **Meal Plan Generation** - Creates complete weekly meal plans with balanced nutrition
3. **Ingredient Substitution** - Suggests budget-friendly alternatives for expensive ingredients

### How It Works

```typescript
// Example: AI Recipe Suggestion Flow
1. User clicks "Get AI Suggestions"
2. Frontend sends request to /ai/suggest-recipes
3. Backend fetches user's pantry items
4. Constructs optimized prompt for Gemini AI
5. Gemini AI generates recipe suggestions
6. Backend normalizes units and validates data
7. Returns formatted recipes to frontend
8. User sees 3-5 recipe cards with ingredients, instructions, cost estimates
```

### Unit Normalization

The system automatically normalizes AI-generated ingredient units to ensure database compatibility:

```
"1 lb chicken" → 1 lbs
"2 cloves garlic" → 2 pieces
"pinch of salt" → 0.25 tsp
```

---

## ⚡ Performance Optimizations

### Frontend
- Code splitting (automatic with Next.js)
- Image optimization with lazy loading
- Debounced search inputs
- React.memo for expensive components
- Client-side caching with Zustand

### Backend
- Database indexing on frequently queried columns
- Query optimization (only fetch needed fields)
- PostgreSQL connection pooling
- Gzip compression for API responses
- Strategic pagination (default: 20 items/page)

### Metrics
- **Average API Response**: < 200ms
- **Database Queries**: < 50ms (with indexes)
- **AI Requests**: 2-5 seconds (external dependency)
- **Frontend First Paint**: < 1.5s

---

## 🧪 Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests
cd frontend
npm test
npm run test:e2e
```

### Coverage Goals
- Unit Tests: > 80%
- Integration Tests: All API endpoints
- E2E Tests: Critical user flows

---

## 🚢 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Generate strong JWT secret (48+ chars)
- [ ] Configure production database
- [ ] Set up SSL/TLS certificates
- [ ] Configure CORS for production domain
- [ ] Enable database backups
- [ ] Set up monitoring & logging
- [ ] Configure error tracking (Sentry)
- [ ] Set up CI/CD pipeline

### Docker Deployment

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🎓 Learning Outcomes

This project demonstrates proficiency in:

### Technical Skills
✅ Full-Stack Development (Next.js + Node.js)
✅ TypeScript (Advanced types & interfaces)
✅ RESTful API Design
✅ Database Design & Optimization
✅ Authentication & Security
✅ AI Integration (Google Gemini)
✅ DevOps (Docker, CI/CD)

### Software Engineering
✅ Clean Architecture (MVC pattern)
✅ SOLID Principles
✅ Error Handling
✅ API Documentation
✅ Git Best Practices

### Problem Solving
✅ Complex State Management
✅ Data Modeling
✅ Algorithm Design
✅ Performance Optimization

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Commit Convention
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Ervenderr**
- Email: ervenderr@yopmail.com
- GitHub: [@ervenderr](https://github.com/ervenderr)
- LinkedIn: [ErvenDerr](https://linkedin.com/in/ervenderr)

---

## 🙏 Acknowledgments

- Google Gemini AI for powerful AI capabilities
- Prisma for excellent ORM tooling
- Next.js Team for the amazing React framework
- PostgreSQL community for robust database
- Open Source Community for incredible tools

---

<div align="center">

### ⭐ Star this repository if you find it helpful!

**Built with ❤️ by Ervenderr**

*Showcasing modern full-stack development with AI integration*

</div>
