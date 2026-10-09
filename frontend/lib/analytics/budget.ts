import type { BudgetHealth } from '@/types/budget.types';

/** Backend default `alertThresholdPercentage` (prisma UserPreference). */
export const DEFAULT_WARNING_THRESHOLD = 90;
/** Backend AlertService marks the budget exceeded at >= 100%. */
export const EXCEEDED_THRESHOLD = 100;

export interface BudgetSummary {
  readonly budgetCents: number;
  readonly spentCents: number;
  readonly remainingCents: number;
  readonly percentageUsed: number;
  readonly status: BudgetHealth;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const HEALTH_VALUES: readonly string[] = ['healthy', 'warning', 'exceeded'];

export function getBudgetHealth(
  percentageUsed: number | null | undefined,
  warningThreshold: number = DEFAULT_WARNING_THRESHOLD,
): BudgetHealth | null {
  if (!isFiniteNumber(percentageUsed)) return null;
  if (percentageUsed >= EXCEEDED_THRESHOLD) return 'exceeded';
  if (percentageUsed >= warningThreshold) return 'warning';
  return 'healthy';
}

export function formatPercent(value: number | null | undefined): string {
  return isFiniteNumber(value) ? `${Math.round(value)}%` : 'N/A';
}

interface RawBudget {
  budget: unknown;
  spent: unknown;
  remaining: unknown;
  percentage: unknown;
  status: unknown;
}

function summarize(raw: RawBudget): BudgetSummary | null {
  if (!isFiniteNumber(raw.budget) || raw.budget <= 0) return null;
  if (!isFiniteNumber(raw.spent)) return null;

  const percentageUsed = isFiniteNumber(raw.percentage)
    ? raw.percentage
    : (raw.spent / raw.budget) * 100;
  const remainingCents = raw.budget - raw.spent;
  const serverStatus =
    typeof raw.status === 'string' && HEALTH_VALUES.includes(raw.status)
      ? (raw.status as BudgetHealth)
      : null;
  const status = serverStatus ?? getBudgetHealth(percentageUsed);
  if (status === null) return null;

  return {
    budgetCents: raw.budget,
    spentCents: raw.spent,
    remainingCents: isFiniteNumber(raw.remaining) ? raw.remaining : remainingCents,
    percentageUsed,
    status,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * Summarize one `BudgetComparison` (analytics dashboard `budgetStatus` /
 * budget-comparison entries). Returns null when data is missing so the UI
 * can show "N/A". The comparison `status` (under/on/over) is not used; the
 * health is derived from the percentage.
 */
export function budgetFromComparison(input: unknown): BudgetSummary | null {
  const r = asRecord(input);
  return summarize({
    budget: r.budgetCents,
    spent: r.actualSpentCents,
    remaining: undefined,
    percentage: r.percentageUsed,
    status: undefined,
  });
}

/** Summarize `GET /alerts/budget/status` (honours the server's per-user status). */
export function budgetFromAlertStatus(input: unknown): BudgetSummary | null {
  const r = asRecord(input);
  return summarize({
    budget: r.weeklyBudgetCents,
    spent: r.spentThisWeekCents,
    remaining: r.remainingCents,
    percentage: r.percentageUsed,
    status: r.status,
  });
}
