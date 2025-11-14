# Kitcha - Frontend

Modern, mobile-first web application for meal planning, pantry management, and budget tracking.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS v4
- **State Management:**
  - React Query (TanStack Query v5) - Server state
  - Zustand - Client state
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **UI Components:** Radix UI primitives
- **Animations:** Framer Motion
- **HTTP Client:** Axios

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Backend API running on `http://localhost:3001`

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload

# Building
npm run build        # Create production build
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
npm run type-check   # Run TypeScript type checking
```

## Environment Variables

Create a `.env.local` file:

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Implementation Progress

See [../FRONTEND_IMPLEMENTATION_PLAN.md](../FRONTEND_IMPLEMENTATION_PLAN.md) for detailed roadmap.

### ✅ Phase 1: Foundation Setup (COMPLETE)
- [x] Next.js project initialized
- [x] Dependencies installed
- [x] Project structure created
- [x] API client configured
- [x] State management setup
- [x] Design system defined

### 🟡 Next Phase: Authentication & Layout
- [ ] Landing page
- [ ] Login/Signup pages
- [ ] Dashboard layout
- [ ] Protected routes

## License

MIT
