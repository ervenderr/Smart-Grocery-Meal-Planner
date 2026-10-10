const FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Accepted on Oct 10, 2026" or null when there is no valid consent date. */
export function formatConsentCaption(consentedAt: string | null): string | null {
  if (!consentedAt) return null;
  const date = new Date(consentedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Accepted on ${FORMATTER.format(date)}`;
}
