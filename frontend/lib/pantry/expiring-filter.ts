import { getDaysUntilExpiry, WARNING_DAYS } from './expiry';

/** Items expiring today through WARNING_DAYS from now; order kept, input untouched. */
export function filterExpiring<T extends { expiryDate?: string | null }>(
  items: readonly T[],
  now: Date,
): T[] {
  return items.filter((item) => {
    const days = getDaysUntilExpiry(item.expiryDate, now);
    return days !== null && days >= 0 && days <= WARNING_DAYS;
  });
}
