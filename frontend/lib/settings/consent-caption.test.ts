import { describe, it, expect } from 'vitest';
import { formatConsentCaption } from './consent-caption';

describe('formatConsentCaption', () => {
  it('formats an ISO date', () => {
    expect(formatConsentCaption('2026-10-10T08:00:00.000Z')).toBe('Accepted on Oct 10, 2026');
  });
  it('returns null for null', () => {
    expect(formatConsentCaption(null)).toBeNull();
  });
  it('returns null for an invalid date', () => {
    expect(formatConsentCaption('not-a-date')).toBeNull();
  });
});
