import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper handling of conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency value
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format Gemini units
 */
export function formatGeminiUnits(units: number): string {
  return `${units.toFixed(2)} units`;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Get budget status color
 */
export function getBudgetStatusColor(percentage: number): string {
  if (percentage < 70) return 'text-green-600';
  if (percentage < 90) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Get expiry status
 */
export function getExpiryStatus(daysUntilExpiry: number): {
  status: 'ok' | 'warning' | 'critical';
  color: string;
  label: string;
} {
  if (daysUntilExpiry < 0) {
    return { status: 'critical', color: 'bg-red-100 text-red-800', label: 'Expired' };
  }
  if (daysUntilExpiry <= 3) {
    return {
      status: 'critical',
      color: 'bg-red-100 text-red-800',
      label: `${daysUntilExpiry}d - Critical`,
    };
  }
  if (daysUntilExpiry <= 7) {
    return {
      status: 'warning',
      color: 'bg-yellow-100 text-yellow-800',
      label: `${daysUntilExpiry}d - Soon`,
    };
  }
  return {
    status: 'ok',
    color: 'bg-green-100 text-green-800',
    label: `${daysUntilExpiry}d`,
  };
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Truncate text
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
