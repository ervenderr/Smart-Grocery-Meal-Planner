import { parseMajorToCents } from './format';

/** Postgres Int4 safe ceiling; mirrors backend users.validation.ts. */
export const MAX_BUDGET_CENTS = 2_000_000_000;
/** Largest budget a user can type in major units (amounts are stored as major x 100). */
export const MAX_BUDGET_MAJOR = MAX_BUDGET_CENTS / 100;

export type BudgetParseResult =
  | { readonly ok: true; readonly cents: number }
  | { readonly ok: false; readonly message: string };

/** Parse and bound-check a typed budget in major units. */
export function parseBudgetInput(input: string, currency?: string): BudgetParseResult {
  const cents = parseMajorToCents(input, currency);
  if (cents === null) {
    return { ok: false, message: 'Enter a valid amount using digits and a decimal point only.' };
  }
  if (cents > MAX_BUDGET_CENTS) {
    return {
      ok: false,
      message: `Budget can be at most ${MAX_BUDGET_MAJOR.toLocaleString('en-US')}.`,
    };
  }
  return { ok: true, cents };
}
