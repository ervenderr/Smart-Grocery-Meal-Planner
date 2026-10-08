import {
  BarChart3,
  Bell,
  Calendar,
  HelpCircle,
  Home,
  Menu,
  Package,
  Settings,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly exact?: boolean;
}

export interface MoreNavItem extends NavItem {
  readonly group: 'explore' | 'account';
}

export const NAV_PRIMARY: ReadonlyArray<NavItem> = [
  { label: 'Home', href: '/dashboard', icon: Home, exact: true },
  { label: 'Pantry', href: '/pantry', icon: Package },
  { label: 'Meals', href: '/mealplans', icon: Calendar },
  { label: 'Shopping', href: '/shopping', icon: ShoppingBasket },
];

export const NAV_MORE_ICON: LucideIcon = Menu;

export const NAV_MORE: ReadonlyArray<MoreNavItem> = [
  { label: 'Recipes', href: '/recipes', icon: UtensilsCrossed, group: 'explore' },
  { label: 'AI features', href: '/recipes?ai=suggestions', icon: Sparkles, group: 'explore' },
  { label: 'Budget', href: '/budget', icon: TrendingUp, group: 'explore' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, group: 'explore' },
  { label: 'Alerts', href: '/alerts', icon: Bell, group: 'explore' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'account' },
  { label: 'Profile', href: '/profile', icon: User, group: 'account' },
  { label: 'Help', href: '/help', icon: HelpCircle, group: 'account' },
];

export const NAV_SIDEBAR: ReadonlyArray<NavItem> = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Pantry', href: '/pantry', icon: Package },
  { label: 'Recipes', href: '/recipes', icon: UtensilsCrossed },
  { label: 'Meal Plans', href: '/mealplans', icon: Calendar },
  { label: 'Shopping Lists', href: '/shopping', icon: ShoppingBasket },
  { label: 'Budget', href: '/budget', icon: TrendingUp },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const PAGE_TITLES: Readonly<Record<string, string>> = {
  '/dashboard': 'Dashboard',
  '/pantry': 'Pantry',
  '/recipes': 'Recipes',
  '/mealplans': 'Meal Plans',
  '/shopping': 'Shopping',
  '/budget': 'Budget',
  '/analytics': 'Analytics',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
  '/profile': 'Profile',
  '/help': 'Help',
};

const DEFAULT_TITLE = 'Kitcha';

function stripQuery(href: string): string {
  const index = href.indexOf('?');
  return index === -1 ? href : href.slice(0, index);
}

export function isActive(pathname: string | null, href: string, exact = false): boolean {
  if (!pathname) return false;
  const target = stripQuery(href);
  if (pathname === target) return true;
  return !exact && pathname.startsWith(`${target}/`);
}

export function isMoreActive(pathname: string | null): boolean {
  if (!pathname) return false;
  const inPrimary = NAV_PRIMARY.some((item) => isActive(pathname, item.href, item.exact));
  if (inPrimary) return false;
  return NAV_MORE.some((item) => isActive(pathname, item.href));
}

export function getPageTitle(pathname: string | null): string {
  if (!pathname) return DEFAULT_TITLE;
  const key = Object.keys(PAGE_TITLES).find((route) => isActive(pathname, route));
  return key ? PAGE_TITLES[key] : DEFAULT_TITLE;
}
