# Kitcha - Frontend Implementation Plan

## 📋 Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Design System & UI/UX](#design-system--uiux)
5. [Component Architecture](#component-architecture)
6. [Page-by-Page Implementation](#page-by-page-implementation)
7. [State Management Strategy](#state-management-strategy)
8. [Mobile-First Responsive Design](#mobile-first-responsive-design)
9. [Implementation Phases](#implementation-phases)
10. [Progress Tracker](#progress-tracker)

---

## Overview

### Project Goals
- **Mobile-First**: Design for mobile devices first, then scale up to tablets and desktops
- **Responsive**: Fluid layouts that adapt to any screen size
- **Modern UI/UX**: Clean, intuitive interface following best practices
- **User-Friendly**: Accessible, fast, and easy to navigate
- **Best Practices**: Code quality, performance optimization, and maintainability

### Backend Integration
- Backend API already implemented with all endpoints
- Express + TypeScript backend with Prisma ORM
- PostgreSQL database with complete schema
- JWT authentication system in place
- All 25+ API endpoints ready for frontend consumption

---

## Tech Stack

### Core Technologies
```
Next.js 14 (App Router)        - React framework with SSR/SSG
TypeScript                      - Type safety throughout
TailwindCSS v3                  - Utility-first CSS framework
Shadcn/ui                       - High-quality accessible components
```

### State Management & Data Fetching
```
TanStack Query v5 (React Query) - Server state management
Zustand                         - Client state management (lightweight)
Axios                           - HTTP client with interceptors
```

### Forms & Validation
```
React Hook Form                 - Performant form handling
Zod                            - TypeScript-first schema validation
```

### Charts & Visualization
```
Recharts                       - Composable charting library
React-Chartjs-2 (alternative)  - Chart.js wrapper for React
```

### UI Enhancement
```
Framer Motion                  - Animations and transitions
React Hot Toast                - Toast notifications
Headless UI                    - Unstyled, accessible components
Radix UI (via Shadcn)         - Primitive components
Lucide React                   - Icon library
date-fns                       - Date manipulation
```

### Development Tools
```
ESLint                         - Linting
Prettier                       - Code formatting
Husky                          - Git hooks
```

---

## Project Structure

```
frontend/
├── app/                           # Next.js 14 App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── layout.tsx           # Dashboard layout with sidebar
│   │   ├── page.tsx             # Dashboard home
│   │   ├── pantry/
│   │   │   └── page.tsx
│   │   ├── recipes/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── meal-plans/
│   │   │   ├── page.tsx
│   │   │   ├── create/
│   │   │   │   └── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── edit/
│   │   │           └── page.tsx
│   │   ├── shopping/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── budget/
│   │   │   └── page.tsx
│   │   ├── analytics/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── api/                      # API route handlers (optional)
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   └── globals.css              # Global styles
│
├── components/                   # React components
│   ├── ui/                      # Shadcn UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   ├── layout/                  # Layout components
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── mobile-nav.tsx
│   │   └── footer.tsx
│   ├── auth/                    # Authentication components
│   │   ├── login-form.tsx
│   │   ├── signup-form.tsx
│   │   └── protected-route.tsx
│   ├── dashboard/               # Dashboard components
│   │   ├── stats-card.tsx
│   │   ├── quick-actions.tsx
│   │   └── recent-activity.tsx
│   ├── pantry/                  # Pantry components
│   │   ├── pantry-list.tsx
│   │   ├── pantry-item.tsx
│   │   ├── add-item-form.tsx
│   │   ├── edit-item-form.tsx
│   │   └── expiring-alert.tsx
│   ├── recipes/                 # Recipe components
│   │   ├── recipe-card.tsx
│   │   ├── recipe-details.tsx
│   │   ├── recipe-filter.tsx
│   │   └── recipe-search.tsx
│   ├── meal-plans/              # Meal planning components
│   │   ├── meal-plan-calendar.tsx
│   │   ├── meal-day-editor.tsx
│   │   ├── meal-selector.tsx
│   │   └── cost-summary.tsx
│   ├── shopping/                # Shopping components
│   │   ├── shopping-list.tsx
│   │   ├── shopping-item.tsx
│   │   └── checkout-form.tsx
│   ├── budget/                  # Budget components
│   │   ├── budget-progress.tsx
│   │   ├── gemini-converter.tsx
│   │   └── alert-settings.tsx
│   ├── analytics/               # Analytics components
│   │   ├── spending-chart.tsx
│   │   ├── category-pie-chart.tsx
│   │   ├── trend-line.tsx
│   │   └── price-comparison.tsx
│   └── common/                  # Shared components
│       ├── loading-spinner.tsx
│       ├── error-boundary.tsx
│       ├── empty-state.tsx
│       ├── confirm-dialog.tsx
│       └── skeleton.tsx
│
├── lib/                          # Utilities and configurations
│   ├── api/                     # API client
│   │   ├── client.ts           # Axios instance with interceptors
│   │   ├── auth.ts             # Auth API calls
│   │   ├── pantry.ts           # Pantry API calls
│   │   ├── recipes.ts          # Recipe API calls
│   │   ├── meal-plans.ts       # Meal plan API calls
│   │   ├── shopping.ts         # Shopping API calls
│   │   ├── budget.ts           # Budget API calls
│   │   └── analytics.ts        # Analytics API calls
│   ├── hooks/                   # Custom React hooks
│   │   ├── use-auth.ts         # Authentication hook
│   │   ├── use-pantry.ts       # Pantry operations
│   │   ├── use-recipes.ts      # Recipe operations
│   │   ├── use-meal-plans.ts   # Meal plan operations
│   │   ├── use-shopping.ts     # Shopping operations
│   │   ├── use-budget.ts       # Budget operations
│   │   ├── use-analytics.ts    # Analytics data
│   │   ├── use-mobile.ts       # Mobile detection
│   │   └── use-toast.ts        # Toast notifications
│   ├── stores/                  # Zustand stores
│   │   ├── auth-store.ts       # Auth state
│   │   ├── ui-store.ts         # UI state (sidebar, modals)
│   │   └── cart-store.ts       # Temporary state
│   ├── utils/                   # Utility functions
│   │   ├── format.ts           # Formatting utilities
│   │   ├── validation.ts       # Validation helpers
│   │   ├── date.ts             # Date utilities
│   │   └── currency.ts         # Currency conversion
│   └── constants/               # Constants
│       ├── api-routes.ts       # API endpoint constants
│       ├── categories.ts       # Category lists
│       └── units.ts            # Unit types
│
├── types/                        # TypeScript types
│   ├── auth.types.ts
│   ├── pantry.types.ts
│   ├── recipe.types.ts
│   ├── meal-plan.types.ts
│   ├── shopping.types.ts
│   ├── budget.types.ts
│   ├── analytics.types.ts
│   └── common.types.ts
│
├── styles/                       # Additional styles
│   └── globals.css              # Global CSS (if needed)
│
├── public/                       # Static assets
│   ├── images/
│   ├── icons/
│   └── fonts/
│
├── .env.local                    # Environment variables
├── .env.example                  # Example env file
├── next.config.js               # Next.js configuration
├── tailwind.config.js           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies
└── README.md                    # Frontend documentation
```

---

## Design System & UI/UX

### Color Palette (Mobile-First)

```css
/* Primary Colors */
--primary-50: #f0f9ff;
--primary-100: #e0f2fe;
--primary-500: #0ea5e9;  /* Main brand color */
--primary-600: #0284c7;
--primary-700: #0369a1;

/* Neutral Colors */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-500: #6b7280;
--gray-900: #111827;

/* Semantic Colors */
--success-500: #10b981;
--warning-500: #f59e0b;
--error-500: #ef4444;
--info-500: #3b82f6;

/* Budget Status Colors */
--budget-safe: #10b981;     /* Green - under 70% */
--budget-warning: #f59e0b;  /* Yellow - 70-90% */
--budget-danger: #ef4444;   /* Red - over 90% */

/* Expiry Status Colors */
--expiry-ok: #10b981;       /* Green - > 7 days */
--expiry-warning: #f59e0b;  /* Yellow - 3-7 days */
--expiry-critical: #ef4444; /* Red - < 3 days */
```

### Typography

```css
/* Font Family */
font-family: 'Inter', system-ui, -apple-system, sans-serif;

/* Font Sizes (Mobile-First) */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

### Spacing System

```css
/* Spacing Scale (rem) */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

### Breakpoints

```css
/* Mobile First Approach */
/* Base: 320px - 639px (Mobile) */

sm: '640px',   /* Tablet portrait */
md: '768px',   /* Tablet landscape */
lg: '1024px',  /* Desktop */
xl: '1280px',  /* Large desktop */
2xl: '1536px'  /* Extra large desktop */
```

### UI Components Standards

#### Buttons
```tsx
/* Primary Button */
- Height: 44px (mobile), 40px (desktop) - Touch-friendly
- Padding: 12px 24px
- Border radius: 8px
- Font weight: 600
- Active states with haptic feedback (mobile)

/* Button Sizes */
- sm: 36px height
- md: 44px height (default mobile)
- lg: 52px height
```

#### Cards
```tsx
/* Card Component */
- Border radius: 12px
- Shadow: soft, subtle
- Padding: 16px (mobile), 24px (desktop)
- Gap between elements: 12px
- Hover state: slight elevation
```

#### Forms
```tsx
/* Input Fields */
- Height: 44px (mobile-friendly touch target)
- Padding: 12px 16px
- Border: 1px solid with focus ring
- Border radius: 8px
- Label above input
- Error states with icon + message
```

### Accessibility Standards

```
✅ WCAG 2.1 Level AA Compliance
✅ Minimum touch target: 44x44px
✅ Color contrast ratio: 4.5:1 for text
✅ Keyboard navigation support
✅ Screen reader friendly
✅ Focus indicators visible
✅ Semantic HTML
✅ ARIA labels where needed
```

---

## Component Architecture

### Component Hierarchy

```
App
├── Layout (Root)
│   ├── Header
│   │   ├── Logo
│   │   ├── Navigation (Desktop)
│   │   └── UserMenu
│   ├── MobileNav (Hamburger menu)
│   └── Sidebar (Desktop only)
│
├── Auth Pages
│   ├── LoginForm
│   │   ├── EmailInput
│   │   ├── PasswordInput
│   │   └── SubmitButton
│   └── SignupForm
│       ├── EmailInput
│       ├── PasswordInput
│       ├── ConfirmPassword
│       └── PreferencesStep
│
├── Dashboard
│   ├── StatsGrid
│   │   ├── StatCard (Pantry items)
│   │   ├── StatCard (Budget)
│   │   ├── StatCard (Upcoming meals)
│   │   └── StatCard (Expiring items)
│   ├── QuickActions
│   │   ├── AddToPantryButton
│   │   ├── CreateMealPlanButton
│   │   └── ViewShoppingListButton
│   ├── AlertsSection
│   │   └── AlertCard[]
│   ├── ExpiringItemsWidget
│   │   └── PantryItem[]
│   └── SpendingChart
│       └── LineChart
│
├── Pantry Page
│   ├── PantryHeader
│   │   ├── SearchBar
│   │   ├── FilterDropdown
│   │   └── AddItemButton
│   ├── CategoryTabs (Mobile)
│   ├── PantryGrid
│   │   └── PantryItemCard[]
│   │       ├── ItemImage
│   │       ├── ItemDetails
│   │       ├── ExpiryBadge
│   │       └── ActionMenu
│   └── AddItemModal
│       └── AddItemForm
│
├── Recipes Page
│   ├── RecipeHeader
│   │   ├── SearchBar
│   │   └── FilterPanel
│   ├── RecipeGrid
│   │   └── RecipeCard[]
│   │       ├── RecipeImage
│   │       ├── RecipeInfo
│   │       ├── CostBadge
│   │       └── FavoriteButton
│   └── RecipeDetailModal
│       ├── Ingredients
│       ├── Instructions
│       ├── Nutrition
│       └── AddToMealPlanButton
│
├── Meal Plans Page
│   ├── MealPlansHeader
│   │   ├── ViewToggle (Calendar/List)
│   │   └── CreateButton
│   ├── CalendarView
│   │   ├── WeekNavigator
│   │   ├── DayColumns[]
│   │   │   └── MealSlots[]
│   │   │       └── MealCard
│   │   └── CostSummary
│   └── CreateMealPlanWizard
│       ├── DateSelection
│       ├── MealSelection (Drag & Drop)
│       ├── ServingsAdjustment
│       └── Review
│
├── Shopping Page
│   ├── ShoppingListHeader
│   │   ├── ProgressBar
│   │   └── GenerateButton
│   ├── CategorySections[]
│   │   └── ShoppingItem[]
│   │       ├── Checkbox
│   │       ├── ItemDetails
│   │       ├── PriceInput
│   │       └── Notes
│   ├── CostSummary
│   │   ├── EstimatedTotal
│   │   ├── ActualTotal
│   │   └── Savings
│   └── CompleteButton
│
├── Budget Page
│   ├── BudgetOverview
│   │   ├── BudgetGauge
│   │   ├── WeeklyLimit
│   │   ├── Spent
│   │   └── Remaining
│   ├── SpendingTrendChart
│   ├── CategoryBreakdownChart
│   ├── GeminiPriceWidget
│   │   ├── CurrentPrice
│   │   ├── Converter
│   │   └── History
│   └── AlertSettings
│       ├── ThresholdSlider
│       └── NotificationToggles
│
└── Analytics Page
    ├── DateRangeSelector
    ├── MetricsGrid
    │   ├── TotalSpending
    │   ├── AverageMeal
    │   ├── Savings
    │   └── WasteReduction
    ├── ChartsSection
    │   ├── SpendingTrendLine
    │   ├── CategoryPieChart
    │   ├── PriceComparisonBar
    │   └── MealPlanStats
    └── InsightsPanel
        └── AIInsight[]
```

---

## Page-by-Page Implementation

### 1. Landing Page (`/`)

**Mobile Layout:**
```
┌─────────────────────┐
│ [Logo]    [Login]   │  ← Sticky header
├─────────────────────┤
│                     │
│   Hero Section      │
│   • Headline        │
│   • Subheadline     │
│   • CTA Button      │
│   • Hero Image      │
│                     │
├─────────────────────┤
│  Features (Stacked) │
│  ┌─────────────┐   │
│  │ Feature 1   │   │
│  └─────────────┘   │
│  ┌─────────────┐   │
│  │ Feature 2   │   │
│  └─────────────┘   │
│  ┌─────────────┐   │
│  │ Feature 3   │   │
│  └─────────────┘   │
├─────────────────────┤
│   How It Works      │
│   (Step-by-step)    │
├─────────────────────┤
│   CTA Section       │
│   [Get Started]     │
└─────────────────────┘
```

**Desktop Layout (md: breakpoint):**
- Hero section with image side-by-side
- Features in 3-column grid
- Full-width sections with max-width container

**Components:**
- `Hero.tsx`
- `FeatureCard.tsx`
- `HowItWorksStep.tsx`
- `CTASection.tsx`

---

### 2. Authentication Pages

#### Login Page (`/login`)

**Mobile Layout:**
```
┌─────────────────────┐
│      [Logo]         │
│                     │
│  Welcome Back!      │
│                     │
│  ┌───────────────┐  │
│  │ Email         │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │ Password      │  │
│  └───────────────┘  │
│  [ ] Remember me   │
│                     │
│  [Login Button]     │
│                     │
│  Forgot password?   │
│  Don't have account?│
│  [Sign Up]          │
└─────────────────────┘
```

**Features:**
- Auto-focus email input
- Show/hide password toggle
- Form validation with Zod
- Loading state on submit
- Error messages inline
- Social login placeholders (future)

**Components:**
- `LoginForm.tsx`
- `PasswordInput.tsx`
- `FormError.tsx`

#### Signup Page (`/signup`)

**Multi-step form:**

**Step 1: Account Details**
```
┌─────────────────────┐
│ Create Account      │
│ Step 1 of 2         │
│                     │
│ ┌───────────────┐   │
│ │ Email         │   │
│ └───────────────┘   │
│ ┌───────────────┐   │
│ │ Password      │   │
│ └───────────────┘   │
│ ┌───────────────┐   │
│ │ Confirm Pass  │   │
│ └───────────────┘   │
│                     │
│ [Next Step]         │
└─────────────────────┘
```

**Step 2: Preferences**
```
┌─────────────────────┐
│ Set Preferences     │
│ Step 2 of 2         │
│                     │
│ Weekly Budget:      │
│ ┌───────────────┐   │
│ │ $100          │   │
│ └───────────────┘   │
│ Dietary:            │
│ [ ] Vegetarian      │
│ [ ] Vegan           │
│ [ ] Gluten-free     │
│                     │
│ [Create Account]    │
└─────────────────────┘
```

---

### 3. Dashboard (`/dashboard`)

**Mobile Layout:**
```
┌─────────────────────┐
│ ☰  Dashboard    👤  │  ← Header with menu
├─────────────────────┤
│ Hi, John! 👋        │
│                     │
│ ┌─────────────────┐ │  ← Stats grid (stacked)
│ │ 24 Items        │ │
│ │ In Pantry       │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ $95 / $100      │ │
│ │ Budget (95%)    │ │
│ │ ████████░       │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 3 Items         │ │
│ │ Expiring Soon   │ │
│ └─────────────────┘ │
│                     │
│ Quick Actions       │
│ ┌────┐ ┌────┐      │
│ │ +  │ │ 🛒 │      │
│ │Item│ │List│      │
│ └────┘ └────┘      │
│                     │
│ Alerts (2)          │
│ ┌─────────────────┐ │
│ │ ⚠️ Budget at 95%│ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 🥦 Veggies exp  │ │
│ └─────────────────┘ │
│                     │
│ Spending Trend      │
│ ┌─────────────────┐ │
│ │  📈 Chart       │ │
│ └─────────────────┘ │
└─────────────────────┘
│ [Bottom Nav]        │  ← Mobile navigation
└─────────────────────┘
```

**Desktop Layout (lg: breakpoint):**
```
┌────────┬──────────────────────────────────┐
│        │ Dashboard                    👤  │
│ Side   ├──────────────────────────────────┤
│ bar    │ Hi, John! 👋                     │
│        │                                  │
│ Home   │ ┌──────┐ ┌──────┐ ┌──────┐      │
│ Pantry │ │ 24   │ │ $95  │ │  3   │      │
│ Recipes│ │Items │ │Used  │ │Expiry│      │
│ Meals  │ └──────┘ └──────┘ └──────┘      │
│ Shop   │                                  │
│ Budget │ Alerts            Quick Actions  │
│ Stats  │ ┌──────────────┐  ┌────┐ ┌────┐│
│        │ │ ⚠️ Alert 1   │  │ +  │ │ 🛒 ││
│        │ └──────────────┘  └────┘ └────┘│
│        │                                  │
│        │ Spending Trend                   │
│        │ ┌──────────────────────────────┐│
│        │ │     📈 Line Chart            ││
│        │ └──────────────────────────────┘│
└────────┴──────────────────────────────────┘
```

**Key Features:**
- Real-time budget progress
- Expiring items preview
- Recent activity feed
- Quick action buttons
- Alert notifications
- Spending trend visualization

**Components:**
- `DashboardLayout.tsx`
- `StatsCard.tsx`
- `QuickActionButton.tsx`
- `AlertCard.tsx`
- `SpendingTrendChart.tsx`

---

### 4. Pantry Page (`/dashboard/pantry`)

**Mobile Layout:**
```
┌─────────────────────┐
│ ← Pantry        +   │  ← Header with add button
├─────────────────────┤
│ 🔍 Search...        │  ← Search bar
│                     │
│ All | Protein | ... │  ← Category tabs (swipeable)
├─────────────────────┤
│ Sort: Expiry ▼      │  ← Sort dropdown
│ Filter: All ▼       │  ← Filter dropdown
├─────────────────────┤
│                     │
│ ┌─────────────────┐ │  ← Item card
│ │ 🍗 Chicken      │ │
│ │ 2 lbs           │ │
│ │ Expires: Nov 14 │ │
│ │ 🔴 2 days       │ │
│ │ Freezer         │ │
│ │         ⋮       │ │  ← Action menu
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 🥛 Milk         │ │
│ │ 1 gallon        │ │
│ │ Expires: Nov 20 │ │
│ │ 🟡 6 days       │ │
│ │ Fridge          │ │
│ │         ⋮       │ │
│ └─────────────────┘ │
│                     │
│ ...more items...    │
│                     │
└─────────────────────┘
```

**Desktop Layout:**
- Sidebar persistent
- 3-4 column grid
- Filters in sidebar
- Larger cards with more details

**Item Card Details:**
```
┌───────────────────────┐
│ 🍗                    │  ← Icon/Image
│ Chicken Breast        │  ← Name
│ 2 lbs                 │  ← Quantity + Unit
│ Freezer               │  ← Location
│ Purchased: Nov 1      │  ← Purchase date
│ Expires: Nov 14       │  ← Expiry date
│ 🔴 Critical (2 days)  │  ← Status badge
│ $8.50                 │  ← Cost
│ [Edit] [Delete]       │  ← Actions
└───────────────────────┘
```

**Add/Edit Item Modal:**
```
┌─────────────────────┐
│ Add Pantry Item  ×  │
├─────────────────────┤
│ Item Name *         │
│ ┌───────────────┐   │
│ │ Chicken Breast│   │
│ └───────────────┘   │
│                     │
│ Quantity *          │
│ ┌──────┐ ┌────────┐│
│ │  2   │ │ lbs ▼  ││
│ └──────┘ └────────┘│
│                     │
│ Category *          │
│ ┌───────────────┐   │
│ │ Protein    ▼  │   │
│ └───────────────┘   │
│                     │
│ Location            │
│ ┌───────────────┐   │
│ │ Freezer    ▼  │   │
│ └───────────────┘   │
│                     │
│ Purchase Date       │
│ ┌───────────────┐   │
│ │ 📅 Nov 1, 2025│   │
│ └───────────────┘   │
│                     │
│ Expiry Date *       │
│ ┌───────────────┐   │
│ │ 📅 Nov 14,2025│   │
│ └───────────────┘   │
│                     │
│ Purchase Price      │
│ ┌───────────────┐   │
│ │ $ 8.50        │   │
│ └───────────────┘   │
│                     │
│ Notes               │
│ ┌───────────────┐   │
│ │ Organic       │   │
│ └───────────────┘   │
│                     │
│ [Cancel]  [Save]    │
└─────────────────────┘
```

**Key Features:**
- Quick search with debounce
- Category filtering (tabs on mobile, chips on desktop)
- Sort by: expiry, name, category, date added
- Color-coded expiry status
- Swipe to delete (mobile)
- Bulk actions (desktop)
- Export to CSV

**Components:**
- `PantryList.tsx`
- `PantryItemCard.tsx`
- `PantryFilters.tsx`
- `AddItemForm.tsx`
- `EditItemForm.tsx`
- `ExpiryBadge.tsx`
- `CategoryTabs.tsx`

---

### 5. Recipes Page (`/dashboard/recipes`)

**Mobile Layout:**
```
┌─────────────────────┐
│ Recipes          ⭐  │  ← Favorites toggle
├─────────────────────┤
│ 🔍 Search recipes...│
│                     │
│ Filters             │
│ Time: Any ▼         │
│ Type: All ▼         │
├─────────────────────┤
│                     │
│ ┌─────────────────┐ │  ← Recipe card
│ │ 📸 Image        │ │
│ │                 │ │
│ │ Chicken Stir Fry│ │
│ │ ⏱ 25 min  🍽 4  │ │
│ │ 💰 $8.00        │ │
│ │         ⭐      │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 📸 Image        │ │
│ │                 │ │
│ │ Pasta Carbonara │ │
│ │ ⏱ 30 min  🍽 4  │ │
│ │ 💰 $12.00       │ │
│ │         ⭐      │ │
│ └─────────────────┘ │
│                     │
│ ...more recipes...  │
└─────────────────────┘
```

**Recipe Detail Modal/Page:**
```
┌─────────────────────┐
│ ← Chicken Stir Fry ⭐│
├─────────────────────┤
│ ┌─────────────────┐ │
│ │                 │ │
│ │   Recipe Image  │ │
│ │                 │ │
│ └─────────────────┘ │
│                     │
│ ⏱ 25 min  🍽 4     │
│ 💰 $8.00  🔥 350cal│
│                     │
│ Ingredients         │
│ ┌─────────────────┐ │
│ │ ☐ 800g Chicken  │ │
│ │ ☐ 2 Bell Peppers│ │
│ │ ☐ 3 tbsp Soy    │ │
│ └─────────────────┘ │
│                     │
│ Instructions        │
│ 1. Heat oil...      │
│ 2. Add chicken...   │
│ 3. Stir fry...      │
│                     │
│ Nutrition           │
│ Protein: 35g        │
│ Carbs: 20g          │
│ Fat: 15g            │
│                     │
│ [Add to Meal Plan]  │
└─────────────────────┘
```

**Key Features:**
- Image-first design
- Quick filters (time, servings, cost)
- Search with autocomplete
- Favorite/unfavorite toggle
- Add to meal plan directly
- Ingredient checklist
- Cost per serving
- Nutrition info
- Servings adjuster (scales ingredients)

**Components:**
- `RecipeGrid.tsx`
- `RecipeCard.tsx`
- `RecipeDetail.tsx`
- `RecipeFilters.tsx`
- `RecipeSearch.tsx`
- `IngredientList.tsx`
- `NutritionInfo.tsx`

---

### 6. Meal Plans Page (`/dashboard/meal-plans`)

**Mobile Layout (Calendar View):**
```
┌─────────────────────┐
│ Meal Plans      +   │
├─────────────────────┤
│ < Nov 12-18, 2025 > │  ← Week navigator
├─────────────────────┤
│                     │
│ Monday, Nov 12      │  ← Day section (scrollable)
│ ┌─────────────────┐ │
│ │ 🌅 Breakfast    │ │
│ │ Oatmeal         │ │
│ │ $2.50           │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 🌞 Lunch        │ │
│ │ Chicken Wrap    │ │
│ │ $5.00           │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 🌙 Dinner       │ │
│ │ Stir Fry        │ │
│ │ $8.00           │ │
│ └─────────────────┘ │
│                     │
│ Tuesday, Nov 13     │
│ ┌─────────────────┐ │
│ │ 🌅 Breakfast    │ │
│ │ [Add Meal]      │ │
│ └─────────────────┘ │
│ ...                 │
│                     │
│ Total: $150.50      │
│ [Generate List]     │
└─────────────────────┘
```

**Desktop Layout (Calendar Grid):**
```
┌────────────────────────────────────────┐
│ Meal Plans    📅 Calendar  📋 List  +  │
├────────────────────────────────────────┤
│        < Nov 12-18, 2025 >             │
├────┬────┬────┬────┬────┬────┬────┬────┤
│    │Mon │Tue │Wed │Thu │Fri │Sat │Sun │
├────┼────┼────┼────┼────┼────┼────┼────┤
│ 🌅 │Oat │[+] │[+] │[+] │[+] │[+] │[+] │
│    │$2.5│    │    │    │    │    │    │
├────┼────┼────┼────┼────┼────┼────┼────┤
│ 🌞 │Wrap│[+] │[+] │[+] │[+] │[+] │[+] │
│    │$5  │    │    │    │    │    │    │
├────┼────┼────┼────┼────┼────┼────┼────┤
│ 🌙 │Stir│[+] │[+] │[+] │[+] │[+] │[+] │
│    │$8  │    │    │    │    │    │    │
└────┴────┴────┴────┴────┴────┴────┴────┘
│ Total Cost: $150.50 | 21 meals planned │
│ [Save as Template] [Generate Shopping] │
└────────────────────────────────────────┘
```

**Create Meal Plan Flow:**

**Step 1: Date Range**
```
┌─────────────────────┐
│ Create Meal Plan    │
│ Step 1 of 3         │
├─────────────────────┤
│ Plan Name           │
│ ┌───────────────┐   │
│ │ Week of Nov 12│   │
│ └───────────────┘   │
│                     │
│ Start Date          │
│ ┌───────────────┐   │
│ │ 📅 Nov 12     │   │
│ └───────────────┘   │
│                     │
│ End Date            │
│ ┌───────────────┐   │
│ │ 📅 Nov 18     │   │
│ └───────────────┘   │
│                     │
│ [Cancel]  [Next]    │
└─────────────────────┘
```

**Step 2: Select Meals**
```
┌─────────────────────┐
│ Select Meals        │
│ Step 2 of 3         │
├─────────────────────┤
│ Monday - Breakfast  │
│                     │
│ 🔍 Search recipes...│
│                     │
│ ┌─────────────────┐ │
│ │ Oatmeal    $2.50│ │
│ │ [Select]        │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ Pancakes   $3.00│ │
│ │ [Select]        │ │
│ └─────────────────┘ │
│                     │
│ Selected: Oatmeal   │
│ Servings: [2] ▼     │
│                     │
│ [Back]    [Next]    │
└─────────────────────┘
```

**Step 3: Review & Save**
```
┌─────────────────────┐
│ Review Plan         │
│ Step 3 of 3         │
├─────────────────────┤
│ Week of Nov 12      │
│ Nov 12 - Nov 18     │
│                     │
│ 21 meals planned    │
│ Total Cost: $150.50 │
│ Avg/day: $21.50     │
│                     │
│ Breakdown:          │
│ Breakfast: $35.00   │
│ Lunch: $52.50       │
│ Dinner: $63.00      │
│                     │
│ [ ] Save as favorite│
│                     │
│ [Back]    [Create]  │
└─────────────────────┘
```

**Key Features:**
- Drag & drop meal assignment (desktop)
- Swipe to add (mobile)
- Recipe search inline
- Servings adjuster
- Cost calculation in real-time
- Copy previous week
- Template saving
- Export to PDF
- Generate shopping list

**Components:**
- `MealPlanCalendar.tsx`
- `MealPlanList.tsx`
- `MealSlot.tsx`
- `MealCard.tsx`
- `MealPlanWizard.tsx`
- `DateRangePicker.tsx`
- `RecipeSelector.tsx`
- `CostSummary.tsx`

---

### 7. Shopping List Page (`/dashboard/shopping/[id]`)

**Mobile Layout:**
```
┌─────────────────────┐
│ ← Shopping List     │
├─────────────────────┤
│ Week of Nov 12      │
│ ████████░ 80%       │  ← Progress bar
│ 12 of 15 items      │
├─────────────────────┤
│ Est: $105  Act: $98 │  ← Cost comparison
│ Saved: $7 💰        │
├─────────────────────┤
│                     │
│ Protein (3)         │  ← Category section
│ ┌─────────────────┐ │
│ │☑ Chicken 2lbs   │ │  ← Checked item
│ │  Est: $16       │ │
│ │  Paid: $15      │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │☐ Ground Beef    │ │  ← Unchecked item
│ │  1 lb           │ │
│ │  Est: $8        │ │
│ └─────────────────┘ │
│                     │
│ Vegetables (5)      │
│ ┌─────────────────┐ │
│ │☑ Tomatoes       │ │
│ │  4 pieces       │ │
│ │  Paid: $3       │ │
│ └─────────────────┘ │
│ ...                 │
│                     │
│ [Mark Complete]     │  ← Complete button (sticky)
└─────────────────────┘
```

**Item Details (Expanded):**
```
┌─────────────────────┐
│ Chicken Breast      │
│ ☑ Checked           │
├─────────────────────┤
│ Quantity Needed     │
│ 2 lbs               │
│                     │
│ Estimated Cost      │
│ $ 16.00             │
│                     │
│ Actual Cost Paid    │
│ ┌───────────────┐   │
│ │ $ 15.00       │   │  ← Input for actual
│ └───────────────┘   │
│                     │
│ Notes               │
│ ┌───────────────┐   │
│ │ Organic       │   │
│ └───────────────┘   │
│                     │
│ [Save]              │
└─────────────────────┘
```

**Complete Shopping Flow:**
```
┌─────────────────────┐
│ Complete Shopping   │
├─────────────────────┤
│ Items Checked:      │
│ 15 of 15 ✓          │
│                     │
│ Estimated Total:    │
│ $105.00             │
│                     │
│ Actual Total Paid:  │
│ ┌───────────────┐   │
│ │ $ 98.00       │   │
│ └───────────────┘   │
│                     │
│ Gemini Conversion:  │
│ Rate: 1.0032        │
│ Units: 97.68        │
│                     │
│ You saved $7! 🎉    │
│                     │
│ [ ] Add to pantry   │
│                     │
│ [Complete]          │
└─────────────────────┘
```

**Key Features:**
- Category grouping
- Check/uncheck items
- Actual price input
- Progress tracking
- Cost comparison (est vs actual)
- Gemini unit conversion
- Notes per item
- Share list (text/email)
- Print friendly
- Auto-add to pantry option

**Components:**
- `ShoppingList.tsx`
- `ShoppingCategorySection.tsx`
- `ShoppingItem.tsx`
- `CheckoutForm.tsx`
- `CostComparison.tsx`
- `GeminiConverter.tsx`
- `ProgressBar.tsx`

---

### 8. Budget Page (`/dashboard/budget`)

**Mobile Layout:**
```
┌─────────────────────┐
│ Budget Overview     │
├─────────────────────┤
│                     │
│    ╱───────╲       │  ← Budget gauge
│   ╱    95%  ╲      │
│  │  $95/$100 │     │
│   ╲    🔴   ╱      │
│    ╲───────╱       │
│                     │
│ This Week           │
│ Spent: $95.00       │
│ Remaining: $5.00    │
│ Status: Warning     │
├─────────────────────┤
│                     │
│ Spending Trend      │
│ ┌─────────────────┐ │
│ │                 │ │
│ │   📈 Chart      │ │  ← Line chart (8 weeks)
│ │                 │ │
│ └─────────────────┘ │
│                     │
│ Avg: $92/week       │
│ Trend: +5% ↗        │
├─────────────────────┤
│                     │
│ Category Breakdown  │
│ ┌─────────────────┐ │
│ │                 │ │
│ │  🥩 Protein 40% │ │  ← Pie chart
│ │  🥦 Veggies 25% │ │
│ │  🥛 Dairy 20%   │ │
│ │  🌾 Grains 15%  │ │
│ │                 │ │
│ └─────────────────┘ │
├─────────────────────┤
│                     │
│ Gemini Price        │
│ Current: 1.0032     │
│ Change: +0.02%      │
│                     │
│ Converter           │
│ ┌──────┐ ┌────────┐│
│ │ $100 │→│ 99.68u ││
│ └──────┘ └────────┘│
├─────────────────────┤
│                     │
│ Alert Settings      │
│ Threshold: 90%      │
│ ┌─────────────────┐ │
│ │ ──────●────     │ │  ← Slider
│ └─────────────────┘ │
│ [ ] Email alerts    │
│ [✓] Push alerts     │
│                     │
└─────────────────────┘
```

**Desktop Layout:**
```
┌─────────────────────────────────────────┐
│ Budget Overview                         │
├──────────────┬──────────────────────────┤
│              │                          │
│   Budget     │    Spending Trend        │
│   Gauge      │    ┌──────────────────┐  │
│   95%        │    │  📈 Line Chart   │  │
│              │    │                  │  │
│              │    └──────────────────┘  │
├──────────────┴──────────────────────────┤
│ Category Breakdown      │ Gemini Price  │
│ ┌────────────┐          │               │
│ │ Pie Chart  │          │ 1.0032        │
│ │            │          │ +0.02%        │
│ └────────────┘          │               │
│                         │ Converter     │
│                         │ $100 → 99.68u │
├─────────────────────────┴───────────────┤
│ Alert Settings                          │
│ Threshold: ──────●──── 90%              │
│ [✓] Email  [✓] Push  [ ] SMS            │
└─────────────────────────────────────────┘
```

**Key Features:**
- Visual budget gauge
- Color-coded status (green/yellow/red)
- Historical spending chart
- Category breakdown
- Gemini price widget
- Real-time converter
- Alert configuration
- Spending forecast
- Export budget report

**Components:**
- `BudgetOverview.tsx`
- `BudgetGauge.tsx`
- `SpendingTrendChart.tsx`
- `CategoryPieChart.tsx`
- `GeminiPriceWidget.tsx`
- `CurrencyConverter.tsx`
- `AlertSettings.tsx`
- `BudgetForecast.tsx`

---

### 9. Analytics Page (`/dashboard/analytics`)

**Mobile Layout:**
```
┌─────────────────────┐
│ Analytics           │
├─────────────────────┤
│ Date Range          │
│ ┌───────────────┐   │
│ │ Last 8 weeks ▼│   │
│ └───────────────┘   │
├─────────────────────┤
│                     │
│ Key Metrics         │
│ ┌────┐ ┌────┐      │
│ │$760│ │$108│      │
│ │Tot │ │Avg │      │
│ └────┘ └────┘      │
│ ┌────┐ ┌────┐      │
│ │ $42│ │-15%│      │
│ │Save│ │Wast│      │
│ └────┘ └────┘      │
├─────────────────────┤
│                     │
│ Spending Over Time  │
│ ┌─────────────────┐ │
│ │                 │ │
│ │   📈 Chart      │ │
│ │                 │ │
│ └─────────────────┘ │
├─────────────────────┤
│                     │
│ Category Analysis   │
│ ┌─────────────────┐ │
│ │                 │ │
│ │   📊 Bar Chart  │ │
│ │                 │ │
│ └─────────────────┘ │
├─────────────────────┤
│                     │
│ Price Comparison    │
│ Your Avg: $2.50     │
│ Market: $2.30       │
│ Diff: +8.7% 📈      │
│                     │
│ ┌─────────────────┐ │
│ │ Comparison Chart│ │
│ └─────────────────┘ │
├─────────────────────┤
│                     │
│ Insights            │
│ ┌─────────────────┐ │
│ │ 💡 You spend    │ │
│ │ 40% on protein  │ │
│ │ Consider...     │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 💡 Prices up    │ │
│ │ 5% this month   │ │
│ └─────────────────┘ │
│                     │
└─────────────────────┘
```

**Charts Breakdown:**

**Spending Trend Line Chart:**
- X-axis: Weeks
- Y-axis: Amount ($)
- Lines: Spending, Budget, Average
- Tooltips with details

**Category Bar Chart:**
- Horizontal bars
- Categories: Protein, Vegetables, Dairy, Grains, Other
- Color-coded
- Percentage labels

**Price Comparison Chart:**
- Your average vs market benchmark
- Side-by-side bars
- Difference indicator

**Key Features:**
- Date range selector
- Multiple chart types
- Downloadable reports (PDF/CSV)
- AI-generated insights
- Trend analysis
- Waste tracking
- Savings calculator
- Goal setting

**Components:**
- `AnalyticsDashboard.tsx`
- `DateRangeSelector.tsx`
- `MetricsGrid.tsx`
- `SpendingLineChart.tsx`
- `CategoryBarChart.tsx`
- `PriceComparisonChart.tsx`
- `InsightsPanel.tsx`
- `ExportButton.tsx`

---

### 10. Settings Page (`/dashboard/settings`)

**Mobile Layout:**
```
┌─────────────────────┐
│ Settings            │
├─────────────────────┤
│                     │
│ Profile             │  ← Section
│ ┌───────────────┐   │
│ │ [Avatar]      │   │
│ │ John Doe      │   │
│ │ [Change]      │   │
│ └───────────────┘   │
│                     │
│ Email               │
│ ┌───────────────┐   │
│ │ john@email.com│   │
│ └───────────────┘   │
│                     │
│ Password            │
│ [Change Password]   │
│                     │
├─────────────────────┤
│ Preferences         │  ← Section
│                     │
│ Weekly Budget       │
│ ┌───────────────┐   │
│ │ $ 100         │   │
│ └───────────────┘   │
│                     │
│ Currency            │
│ ┌───────────────┐   │
│ │ USD        ▼  │   │
│ └───────────────┘   │
│                     │
│ Preferred Units     │
│ ○ Imperial (lbs)    │
│ ● Metric (kg)       │
│                     │
│ Dietary             │
│ [✓] Vegetarian      │
│ [ ] Vegan           │
│ [ ] Gluten-free     │
│                     │
├─────────────────────┤
│ Notifications       │  ← Section
│                     │
│ [✓] Budget alerts   │
│ [✓] Expiry warnings │
│ [ ] Price changes   │
│ [✓] Weekly summary  │
│                     │
├─────────────────────┤
│ Data & Privacy      │  ← Section
│                     │
│ [Export Data]       │
│ [Delete Account]    │
│                     │
├─────────────────────┤
│                     │
│ [Save Changes]      │
│                     │
└─────────────────────┘
```

**Key Features:**
- Profile management
- Password change
- Budget preferences
- Dietary settings
- Notification preferences
- Data export (JSON/CSV)
- Account deletion
- Theme toggle (light/dark)

**Components:**
- `SettingsLayout.tsx`
- `ProfileSection.tsx`
- `PreferencesSection.tsx`
- `NotificationsSection.tsx`
- `DataPrivacySection.tsx`
- `PasswordChangeForm.tsx`

---

## State Management Strategy

### React Query (TanStack Query) - Server State

**Configuration:**
```typescript
// lib/react-query.ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

**Query Keys Structure:**
```typescript
// lib/query-keys.ts
export const queryKeys = {
  auth: {
    profile: ['auth', 'profile'] as const,
  },
  pantry: {
    all: ['pantry'] as const,
    list: (filters?: PantryFilters) => ['pantry', 'list', filters] as const,
    detail: (id: string) => ['pantry', 'detail', id] as const,
    expiring: () => ['pantry', 'expiring'] as const,
  },
  recipes: {
    all: ['recipes'] as const,
    list: (filters?: RecipeFilters) => ['recipes', 'list', filters] as const,
    detail: (id: string) => ['recipes', 'detail', id] as const,
    favorites: () => ['recipes', 'favorites'] as const,
  },
  mealPlans: {
    all: ['mealPlans'] as const,
    list: () => ['mealPlans', 'list'] as const,
    detail: (id: string) => ['mealPlans', 'detail', id] as const,
  },
  shopping: {
    all: ['shopping'] as const,
    lists: () => ['shopping', 'lists'] as const,
    detail: (id: string) => ['shopping', 'detail', id] as const,
  },
  budget: {
    summary: () => ['budget', 'summary'] as const,
    history: () => ['budget', 'history'] as const,
  },
  analytics: {
    dashboard: () => ['analytics', 'dashboard'] as const,
    trends: (weeks: number) => ['analytics', 'trends', weeks] as const,
  },
};
```

**Custom Hooks Examples:**
```typescript
// lib/hooks/use-pantry.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pantryApi } from '@/lib/api/pantry';
import { queryKeys } from '@/lib/query-keys';

export function usePantryItems(filters?: PantryFilters) {
  return useQuery({
    queryKey: queryKeys.pantry.list(filters),
    queryFn: () => pantryApi.getItems(filters),
  });
}

export function useAddPantryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pantryApi.addItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
    },
  });
}

export function useUpdatePantryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePantryItemDto }) =>
      pantryApi.updateItem(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pantry.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
    },
  });
}

export function useDeletePantryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pantryApi.deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
    },
  });
}
```

### Zustand - Client State

**Auth Store:**
```typescript
// lib/stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;

  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

**UI Store:**
```typescript
// lib/stores/ui-store.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  theme: 'light' | 'dark';

  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  theme: 'light',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  setTheme: (theme) => set({ theme }),
}));
```

---

## Mobile-First Responsive Design

### Breakpoint Strategy

```css
/* Mobile First - Base styles for 320px+ */
.container {
  padding: 16px;
  max-width: 100%;
}

/* Tablet - 640px+ */
@media (min-width: 640px) {
  .container {
    padding: 24px;
    max-width: 640px;
    margin: 0 auto;
  }
}

/* Desktop - 1024px+ */
@media (min-width: 1024px) {
  .container {
    padding: 32px;
    max-width: 1024px;
  }
}

/* Large Desktop - 1280px+ */
@media (min-width: 1280px) {
  .container {
    max-width: 1280px;
  }
}
```

### Tailwind Responsive Classes

```tsx
// Example component with mobile-first responsive design
<div className="
  // Mobile (default)
  flex flex-col gap-4 p-4

  // Tablet (sm:)
  sm:flex-row sm:gap-6 sm:p-6

  // Desktop (lg:)
  lg:gap-8 lg:p-8 lg:max-w-7xl lg:mx-auto
">
  {/* Content */}
</div>
```

### Grid Layouts

```tsx
// Responsive grid for cards
<div className="
  grid grid-cols-1           // Mobile: 1 column
  sm:grid-cols-2             // Tablet: 2 columns
  lg:grid-cols-3             // Desktop: 3 columns
  xl:grid-cols-4             // Large: 4 columns
  gap-4 sm:gap-6 lg:gap-8
">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

### Navigation Patterns

**Mobile Navigation:**
- Bottom tab bar (sticky)
- Hamburger menu for secondary items
- Swipe gestures

**Desktop Navigation:**
- Persistent sidebar
- Top bar with breadcrumbs
- Hover states

```tsx
// Mobile bottom nav
<nav className="
  fixed bottom-0 left-0 right-0
  bg-white border-t
  flex justify-around items-center
  h-16 px-4
  lg:hidden  // Hide on desktop
">
  <NavItem icon={<HomeIcon />} label="Home" />
  <NavItem icon={<PantryIcon />} label="Pantry" />
  {/* ... */}
</nav>

// Desktop sidebar
<aside className="
  hidden lg:flex  // Show only on desktop
  flex-col
  w-64 h-screen
  bg-gray-50 border-r
  fixed left-0 top-0
">
  <SidebarNav />
</aside>
```

### Touch-Friendly Design

```css
/* Minimum touch target size */
.button, .link, .input {
  min-height: 44px;
  min-width: 44px;
}

/* Larger tap areas on mobile */
@media (max-width: 640px) {
  .interactive-element {
    padding: 12px 16px;
  }
}

/* Hover states only on devices that support it */
@media (hover: hover) {
  .button:hover {
    background-color: var(--color-hover);
  }
}
```

### Performance Optimization

**Image Optimization:**
```tsx
import Image from 'next/image';

<Image
  src="/recipe-image.jpg"
  alt="Recipe"
  width={400}
  height={300}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  priority={false} // Lazy load
  placeholder="blur"
/>
```

**Code Splitting:**
```tsx
// Dynamic imports for heavy components
import dynamic from 'next/dynamic';

const AnalyticsChart = dynamic(() => import('@/components/analytics/spending-chart'), {
  loading: () => <Skeleton />,
  ssr: false, // Client-side only
});
```

---

## Implementation Phases

### Phase 1: Foundation Setup (Week 1)
**Goal:** Project scaffolding and basic infrastructure

**Tasks:**
- [ ] Initialize Next.js 14 project with App Router
- [ ] Install and configure dependencies
  - [ ] TailwindCSS
  - [ ] Shadcn/ui
  - [ ] TanStack Query
  - [ ] Zustand
  - [ ] Axios
- [ ] Setup project structure (folders)
- [ ] Configure TypeScript
- [ ] Setup ESLint & Prettier
- [ ] Create design system (colors, typography)
- [ ] Setup environment variables
- [ ] Create API client with Axios interceptors
- [ ] Setup authentication store (Zustand)
- [ ] Create React Query provider

**Deliverables:**
✅ Next.js project initialized
✅ All dependencies installed
✅ Project structure created
✅ API client configured
✅ Design system defined

---

### Phase 2: Authentication & Layout (Week 2)
**Goal:** User authentication and main layout

**Tasks:**
- [ ] Create landing page (`/`)
  - [ ] Hero section
  - [ ] Features section
  - [ ] CTA section
- [ ] Build login page
  - [ ] Login form with validation
  - [ ] JWT handling
  - [ ] Error states
  - [ ] Loading states
- [ ] Build signup page
  - [ ] Multi-step form
  - [ ] Email validation
  - [ ] Password strength
  - [ ] Preferences setup
- [ ] Create dashboard layout
  - [ ] Header component
  - [ ] Sidebar (desktop)
  - [ ] Mobile navigation
  - [ ] User menu
- [ ] Implement protected routes
- [ ] Setup route middleware
- [ ] Create loading skeletons
- [ ] Implement error boundaries

**Deliverables:**
✅ Working authentication flow
✅ Protected routes
✅ Responsive layout
✅ Navigation system

---

### Phase 3: Dashboard & Pantry (Week 3)
**Goal:** Dashboard overview and pantry management

**Tasks:**
- [ ] Build Dashboard page
  - [ ] Stats cards
  - [ ] Quick actions
  - [ ] Alerts widget
  - [ ] Expiring items widget
  - [ ] Spending chart
- [ ] Create Pantry page
  - [ ] Pantry list view
  - [ ] Search & filters
  - [ ] Category tabs (mobile)
  - [ ] Sort options
- [ ] Build pantry components
  - [ ] Pantry item card
  - [ ] Add item form
  - [ ] Edit item form
  - [ ] Delete confirmation
  - [ ] Expiry badge
- [ ] Integrate pantry API
  - [ ] GET /api/pantry
  - [ ] POST /api/pantry
  - [ ] PATCH /api/pantry/:id
  - [ ] DELETE /api/pantry/:id
- [ ] Implement real-time search
- [ ] Add optimistic updates
- [ ] Create empty states

**Deliverables:**
✅ Functional dashboard
✅ Full pantry CRUD
✅ Search & filtering
✅ Responsive design

---

### Phase 4: Recipes & Meal Planning (Week 4-5)
**Goal:** Recipe browsing and meal plan creation

**Tasks:**
- [ ] Build Recipes page
  - [ ] Recipe grid
  - [ ] Recipe cards
  - [ ] Search bar
  - [ ] Filter panel
  - [ ] Favorites toggle
- [ ] Create recipe detail modal
  - [ ] Ingredients list
  - [ ] Instructions
  - [ ] Nutrition info
  - [ ] Cost display
  - [ ] Servings adjuster
- [ ] Build Meal Plans page
  - [ ] Calendar view (desktop)
  - [ ] List view (mobile)
  - [ ] Week navigator
  - [ ] Cost summary
- [ ] Create meal plan wizard
  - [ ] Step 1: Date selection
  - [ ] Step 2: Meal selection
  - [ ] Step 3: Review
- [ ] Implement drag & drop (desktop)
- [ ] Add swipe gestures (mobile)
- [ ] Integrate APIs
  - [ ] GET /api/recipes
  - [ ] GET /api/meal-plans
  - [ ] POST /api/meal-plans
  - [ ] DELETE /api/meal-plans/:id
- [ ] Real-time cost calculation
- [ ] Template system

**Deliverables:**
✅ Recipe browsing
✅ Meal plan creation
✅ Calendar interface
✅ Cost tracking

---

### Phase 5: Shopping & Budget (Week 6)
**Goal:** Shopping list and budget tracking

**Tasks:**
- [ ] Build Shopping page
  - [ ] Shopping list view
  - [ ] Category sections
  - [ ] Progress bar
  - [ ] Cost comparison
- [ ] Create shopping components
  - [ ] Shopping item card
  - [ ] Checkbox functionality
  - [ ] Price input
  - [ ] Notes field
- [ ] Implement checkout flow
  - [ ] Mark items
  - [ ] Enter actual costs
  - [ ] Complete shopping
  - [ ] Gemini conversion
- [ ] Build Budget page
  - [ ] Budget gauge
  - [ ] Spending trend chart
  - [ ] Category pie chart
  - [ ] Gemini price widget
  - [ ] Currency converter
  - [ ] Alert settings
- [ ] Integrate APIs
  - [ ] GET /api/shopping-lists
  - [ ] POST /api/shopping-lists/:id/complete
  - [ ] GET /api/budget/summary
  - [ ] GET /api/market-prices/latest
- [ ] Real-time conversions
- [ ] Alert notifications

**Deliverables:**
✅ Shopping list functionality
✅ Budget tracking
✅ Gemini integration
✅ Visual gauges

---

### Phase 6: Analytics & Charts (Week 7)
**Goal:** Analytics dashboard with visualizations

**Tasks:**
- [ ] Build Analytics page
  - [ ] Date range selector
  - [ ] Metrics grid
  - [ ] Charts section
  - [ ] Insights panel
- [ ] Implement charts
  - [ ] Spending trend line chart
  - [ ] Category pie chart
  - [ ] Price comparison bar chart
  - [ ] Meal plan stats
- [ ] Create insights engine
  - [ ] Spending patterns
  - [ ] Category analysis
  - [ ] Waste reduction
  - [ ] Savings calculation
- [ ] Add export functionality
  - [ ] Export to PDF
  - [ ] Export to CSV
  - [ ] Share insights
- [ ] Integrate analytics API
  - [ ] GET /api/analytics/dashboard
  - [ ] GET /api/analytics/spending-trends
- [ ] Optimize chart performance
- [ ] Add chart interactions

**Deliverables:**
✅ Analytics dashboard
✅ Interactive charts
✅ Export functionality
✅ Insights panel

---

### Phase 7: Settings & Polish (Week 8)
**Goal:** Settings page and final polish

**Tasks:**
- [ ] Build Settings page
  - [ ] Profile section
  - [ ] Preferences section
  - [ ] Notifications section
  - [ ] Data & privacy section
- [ ] Implement profile features
  - [ ] Avatar upload
  - [ ] Email change
  - [ ] Password change
- [ ] Add preference controls
  - [ ] Budget settings
  - [ ] Dietary restrictions
  - [ ] Unit preferences
  - [ ] Theme toggle
- [ ] Create notification system
  - [ ] Push notifications
  - [ ] Email preferences
  - [ ] Alert settings
- [ ] Add data export
  - [ ] Export user data
  - [ ] Account deletion
- [ ] Integrate settings API
  - [ ] PATCH /api/users/profile
  - [ ] PATCH /api/users/preferences
- [ ] Polish UI/UX
  - [ ] Animations
  - [ ] Transitions
  - [ ] Loading states
  - [ ] Error handling
- [ ] Accessibility audit
- [ ] Performance optimization

**Deliverables:**
✅ Settings page
✅ Notification system
✅ Data export
✅ Polished UI

---

### Phase 8: Testing & Deployment (Week 9)
**Goal:** Testing, optimization, and deployment

**Tasks:**
- [ ] Write component tests
- [ ] E2E testing (Playwright)
- [ ] Accessibility testing
- [ ] Performance testing
  - [ ] Lighthouse audit
  - [ ] Core Web Vitals
  - [ ] Bundle size optimization
- [ ] Mobile testing
  - [ ] iOS Safari
  - [ ] Android Chrome
  - [ ] Responsive breakpoints
- [ ] Cross-browser testing
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge
- [ ] Setup deployment
  - [ ] Vercel configuration
  - [ ] Environment variables
  - [ ] Build optimization
- [ ] SEO optimization
  - [ ] Meta tags
  - [ ] OG images
  - [ ] Sitemap
  - [ ] Robots.txt
- [ ] Setup monitoring
  - [ ] Error tracking (Sentry)
  - [ ] Analytics (Vercel Analytics)
  - [ ] Performance monitoring
- [ ] Create documentation
  - [ ] User guide
  - [ ] Developer docs
  - [ ] API documentation

**Deliverables:**
✅ Tested application
✅ Deployed to production
✅ Monitoring setup
✅ Documentation complete

---

## Progress Tracker

### Status Legend
- ⬜ Not Started
- 🟡 In Progress
- ✅ Completed
- ⚠️ Blocked
- ❌ Cancelled

---

### Phase 1: Foundation Setup
**Status:** ⬜ Not Started | **Due:** Week 1 | **Progress:** 0%

| Task | Status | Notes |
|------|--------|-------|
| Initialize Next.js project | ⬜ | |
| Install dependencies | ⬜ | |
| Setup project structure | ⬜ | |
| Configure TypeScript | ⬜ | |
| Setup linting | ⬜ | |
| Create design system | ⬜ | |
| Setup environment | ⬜ | |
| Create API client | ⬜ | |
| Setup auth store | ⬜ | |
| Configure React Query | ⬜ | |

---

### Phase 2: Authentication & Layout
**Status:** ⬜ Not Started | **Due:** Week 2 | **Progress:** 0%

| Task | Status | Notes |
|------|--------|-------|
| Landing page | ⬜ | |
| Login page | ⬜ | |
| Signup page | ⬜ | |
| Dashboard layout | ⬜ | |
| Header component | ⬜ | |
| Sidebar component | ⬜ | |
| Mobile navigation | ⬜ | |
| Protected routes | ⬜ | |
| Loading skeletons | ⬜ | |
| Error boundaries | ⬜ | |

---

### Phase 3: Dashboard & Pantry
**Status:** ⬜ Not Started | **Due:** Week 3 | **Progress:** 0%

| Task | Status | Notes |
|------|--------|-------|
| Dashboard page | ⬜ | |
| Stats cards | ⬜ | |
| Quick actions | ⬜ | |
| Alerts widget | ⬜ | |
| Pantry page | ⬜ | |
| Pantry list | ⬜ | |
| Search & filters | ⬜ | |
| Add item form | ⬜ | |
| Edit item form | ⬜ | |
| API integration | ⬜ | |

---

### Phase 4: Recipes & Meal Planning
**Status:** ⬜ Not Started | **Due:** Week 4-5 | **Progress:** 0%

| Task | Status | Notes |
|------|--------|-------|
| Recipes page | ⬜ | |
| Recipe cards | ⬜ | |
| Recipe detail modal | ⬜ | |
| Search & filters | ⬜ | |
| Meal plans page | ⬜ | |
| Calendar view | ⬜ | |
| Meal plan wizard | ⬜ | |
| Drag & drop | ⬜ | |
| Cost calculation | ⬜ | |
| API integration | ⬜ | |

---

### Phase 5: Shopping & Budget
**Status:** ⬜ Not Started | **Due:** Week 6 | **Progress:** 0%

| Task | Status | Notes |
|------|--------|-------|
| Shopping page | ⬜ | |
| Shopping list view | ⬜ | |
| Checkout flow | ⬜ | |
| Budget page | ⬜ | |
| Budget gauge | ⬜ | |
| Spending chart | ⬜ | |
| Category chart | ⬜ | |
| Gemini widget | ⬜ | |
| Alert settings | ⬜ | |
| API integration | ⬜ | |

---

### Phase 6: Analytics & Charts
**Status:** ⬜ Not Started | **Due:** Week 7 | **Progress:** 0%

| Task | Status | Notes |
|------|--------|-------|
| Analytics page | ⬜ | |
| Metrics grid | ⬜ | |
| Spending trend chart | ⬜ | |
| Category pie chart | ⬜ | |
| Price comparison chart | ⬜ | |
| Insights panel | ⬜ | |
| Export functionality | ⬜ | |
| Chart optimization | ⬜ | |
| API integration | ⬜ | |

---

### Phase 7: Settings & Polish
**Status:** ⬜ Not Started | **Due:** Week 8 | **Progress:** 0%

| Task | Status | Notes |
|------|--------|-------|
| Settings page | ⬜ | |
| Profile section | ⬜ | |
| Preferences section | ⬜ | |
| Notifications | ⬜ | |
| Data export | ⬜ | |
| UI animations | ⬜ | |
| Loading states | ⬜ | |
| Error handling | ⬜ | |
| Accessibility | ⬜ | |
| Performance | ⬜ | |

---

### Phase 8: Testing & Deployment
**Status:** ⬜ Not Started | **Due:** Week 9 | **Progress:** 0%

| Task | Status | Notes |
|------|--------|-------|
| Component tests | ⬜ | |
| E2E tests | ⬜ | |
| Accessibility tests | ⬜ | |
| Performance tests | ⬜ | |
| Mobile testing | ⬜ | |
| Cross-browser testing | ⬜ | |
| Deployment setup | ⬜ | |
| SEO optimization | ⬜ | |
| Monitoring setup | ⬜ | |
| Documentation | ⬜ | |

---

## Overall Project Status

### Timeline
- **Start Date:** TBD
- **End Date:** TBD (9 weeks estimated)
- **Current Phase:** Not Started
- **Overall Progress:** 0%

### Progress Breakdown
```
Phase 1: Foundation       ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%
Phase 2: Auth & Layout    ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%
Phase 3: Dashboard        ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%
Phase 4: Recipes & Meals  ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%
Phase 5: Shopping         ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%
Phase 6: Analytics        ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%
Phase 7: Polish           ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%
Phase 8: Deployment       ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%
────────────────────────────────────────
Total Progress:           ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%
```

### Milestones
- [ ] **Milestone 1:** Foundation & Auth Complete (Week 2)
- [ ] **Milestone 2:** Core Features (Pantry, Recipes, Meals) (Week 5)
- [ ] **Milestone 3:** Shopping & Budget Complete (Week 6)
- [ ] **Milestone 4:** Analytics Complete (Week 7)
- [ ] **Milestone 5:** Production Ready (Week 9)

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Set start date** for Phase 1
3. **Initialize Next.js project**
4. **Begin Phase 1 tasks**
5. **Update progress tracker** weekly

---

## Notes

- Update this document as implementation progresses
- Track blockers and issues in the notes column
- Adjust timelines as needed
- Review and refine designs during implementation
- Prioritize mobile experience in all phases

---

**Last Updated:** 2025-11-13
**Version:** 1.0
**Status:** Ready for Implementation
