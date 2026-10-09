import { formatPeriodLabel, formatPeriodRangeLabel } from './period';

/**
 * Pure mappers from the backend analytics payloads (cents, 'YYYY-Www' keys)
 * to recharts-ready points (major units, readable labels). They accept
 * `unknown` and never throw, so a malformed response degrades to an empty
 * chart instead of a crashed page.
 */

export interface TrendChartPoint {
  label: string;
  fullLabel: string;
  /** Major units. */
  spent: number;
  /** Major units, or null when no budget is attached. */
  budget: number | null;
  transactions: number;
}

export interface WeeklyComparisonPoint {
  week: string;
  spent: number;
  budget: number;
  savings: number;
}

export type CategoryChartPoint = {
  name: string;
  value: number;
  percentage: number;
  count: number;
};

type Rec = Record<string, unknown>;

function records(input: unknown): Rec[] {
  const list = Array.isArray(input)
    ? input
    : typeof input === 'object' && input !== null && Array.isArray((input as Rec).trends)
      ? ((input as Rec).trends as unknown[])
      : [];
  return list.filter((x): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x));
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const toMajor = (cents: unknown): number => num(cents) / 100;

export function toTrendChartPoints(input: unknown): TrendChartPoint[] {
  return records(input).map((item) => ({
    label: formatPeriodLabel(item.date),
    fullLabel: formatPeriodRangeLabel(item.date),
    spent: toMajor(item.totalSpentCents),
    budget: num(item.budgetCents) > 0 ? toMajor(item.budgetCents) : null,
    transactions: num(item.transactionCount),
  }));
}

/** Latest `limit` periods, oldest first. */
export function toWeeklyComparisonPoints(input: unknown, limit = 8): WeeklyComparisonPoint[] {
  return records(input)
    .slice(-limit)
    .map((item) => {
      const budgetCents = num(item.budgetCents);
      const spentCents = num(item.totalSpentCents);
      return {
        week: formatPeriodRangeLabel(item.date),
        spent: spentCents / 100,
        budget: budgetCents / 100,
        savings: budgetCents > 0 ? (budgetCents - spentCents) / 100 : 0,
      };
    });
}

export function toCategoryChartPoints(input: unknown, limit = 8): CategoryChartPoint[] {
  return records(input)
    .slice(0, limit)
    .map((item) => {
      const raw = typeof item.category === 'string' ? item.category.trim() : '';
      return {
        name: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Uncategorized',
        value: toMajor(item.totalSpentCents),
        percentage: num(item.percentage),
        count: num(item.itemCount),
      };
    });
}
