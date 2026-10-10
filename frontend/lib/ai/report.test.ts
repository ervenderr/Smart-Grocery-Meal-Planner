import { describe, expect, it } from 'vitest';
import {
  MAX_REPORT_NOTE,
  MAX_SNAPSHOT_BYTES,
  REPORT_REASONS,
  buildReportSnapshot,
  mapReportError,
} from './report';

const size = (value: unknown) => JSON.stringify(value).length;

describe('REPORT_REASONS', () => {
  it('has the four UI-SPEC reasons', () => {
    expect(REPORT_REASONS).toEqual([
      { value: 'inaccurate_or_unsafe', label: 'Inaccurate or unsafe' },
      { value: 'offensive', label: 'Offensive' },
      { value: 'diet_or_allergy_mismatch', label: "Doesn't match my diet or allergies" },
      { value: 'other', label: 'Other' },
    ]);
  });

  it('caps note at 500', () => {
    expect(MAX_REPORT_NOTE).toBe(500);
  });
});

describe('buildReportSnapshot', () => {
  it('returns an equal copy, not the same reference', () => {
    const input = { name: 'Soup', ingredients: [{ ingredientName: 'leek', quantity: 2 }] };
    const out = buildReportSnapshot(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect(size(out)).toBeLessThanOrEqual(MAX_SNAPSHOT_BYTES);
  });

  it('truncates long strings and arrays without mutating input', () => {
    const input = { text: 'x'.repeat(20000), items: Array.from({ length: 500 }, (_, i) => `item-${i}`) };
    const clone = JSON.parse(JSON.stringify(input));
    const out = buildReportSnapshot(input);
    expect(size(out)).toBeLessThanOrEqual(MAX_SNAPSHOT_BYTES);
    expect((out.text as string).length).toBeLessThan(20000);
    expect((out.items as unknown[]).length).toBeLessThan(500);
    expect(input).toEqual(clone);
  });

  it('drops PII keys at any depth', () => {
    const out = buildReportSnapshot({
      email: 'a@b.c',
      firstName: 'A',
      lastName: 'B',
      userId: 'u1',
      keep: 'ok',
      nested: { email: 'x', value: 1 },
    });
    expect(out).toEqual({ keep: 'ok', nested: { value: 1 } });
  });

  it('falls back to { truncated: true } when it cannot fit', () => {
    const wide = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`key${i}`, 'v'.repeat(50)]));
    const out = buildReportSnapshot(wide);
    expect(size(out)).toBeLessThanOrEqual(MAX_SNAPSHOT_BYTES);
  });

  it('handles non-object input', () => {
    expect(buildReportSnapshot('hello')).toEqual({ value: 'hello' });
    expect(buildReportSnapshot(null)).toEqual({});
  });
});

describe('mapReportError', () => {
  it('maps 429', () => {
    expect(mapReportError({ response: { status: 429 } })).toBe(
      "You've sent several reports recently. Try again later."
    );
  });

  it('maps other errors', () => {
    expect(mapReportError({ response: { status: 500 } })).toBe("Couldn't send your report. Try again.");
    expect(mapReportError(new Error('x'))).toBe("Couldn't send your report. Try again.");
  });
});
