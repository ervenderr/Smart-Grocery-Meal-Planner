import { describe, expect, it } from 'vitest';
import { MAX_BUDGET_CENTS, MAX_BUDGET_MAJOR, parseBudgetInput } from './budget';

describe('parseBudgetInput', () => {
  it('accepts values up to the ceiling', () => {
    expect(parseBudgetInput('2000')).toEqual({ ok: true, cents: 200000 });
    expect(parseBudgetInput(String(MAX_BUDGET_MAJOR))).toEqual({
      ok: true,
      cents: MAX_BUDGET_CENTS,
    });
  });

  it('rejects values above the Int4-safe ceiling', () => {
    const over = parseBudgetInput(String(MAX_BUDGET_MAJOR + 1));
    expect(over.ok).toBe(false);
    expect(parseBudgetInput('99999999999').ok).toBe(false);
  });

  it('rejects malformed input with a message', () => {
    const bad = parseBudgetInput('1e3');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message.length).toBeGreaterThan(0);
  });

  it('applies currency fraction digits', () => {
    expect(parseBudgetInput('100.5', 'JPY').ok).toBe(false);
    expect(parseBudgetInput('100', 'JPY')).toEqual({ ok: true, cents: 10000 });
  });
});
