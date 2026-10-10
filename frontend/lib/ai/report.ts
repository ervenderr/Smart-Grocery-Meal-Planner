export type ReportKind = 'recipe' | 'meal_plan' | 'substitution';

export type ReportReason =
  | 'inaccurate_or_unsafe'
  | 'offensive'
  | 'diet_or_allergy_mismatch'
  | 'other';

export const REPORT_REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: 'inaccurate_or_unsafe', label: 'Inaccurate or unsafe' },
  { value: 'offensive', label: 'Offensive' },
  { value: 'diet_or_allergy_mismatch', label: "Doesn't match my diet or allergies" },
  { value: 'other', label: 'Other' },
];

export const MAX_REPORT_NOTE = 500;
export const MAX_SNAPSHOT_BYTES = 8192;

const PII_KEYS: ReadonlySet<string> = new Set(['email', 'firstName', 'lastName', 'userId']);
const INITIAL_STRING_CAP = 500;
const INITIAL_ARRAY_CAP = 20;
const MAX_DEPTH = 8;

function sanitize(value: unknown, stringCap: number, arrayCap: number, depth: number): unknown {
  if (typeof value === 'string') return value.slice(0, stringCap);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, arrayCap).map((item) => sanitize(item, stringCap, arrayCap, depth + 1));
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !PII_KEYS.has(key))
    .map(([key, v]) => [key, sanitize(v, stringCap, arrayCap, depth + 1)] as const)
    .filter(([, v]) => v !== undefined);
  return Object.fromEntries(entries);
}

const encoder = new TextEncoder();

function utf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

function toRecord(input: unknown): unknown {
  if (input === null || input === undefined) return {};
  if (typeof input === 'object' && !Array.isArray(input)) return input;
  return { value: input };
}

/**
 * Builds a PII-free, size-capped copy of an AI item for a report.
 * Pure: never mutates the input.
 */
export function buildReportSnapshot(input: unknown): Record<string, unknown> {
  const source = toRecord(input);
  let stringCap = INITIAL_STRING_CAP;
  let arrayCap = INITIAL_ARRAY_CAP;

  while (stringCap >= 1 && arrayCap >= 1) {
    const candidate = sanitize(source, stringCap, arrayCap, 0) as Record<string, unknown>;
    // Server enforces UTF-8 bytes, so measure bytes (not UTF-16 code units).
    if (utf8ByteLength(JSON.stringify(candidate)) <= MAX_SNAPSHOT_BYTES) return candidate;
    stringCap = Math.floor(stringCap / 2);
    arrayCap = Math.floor(arrayCap / 2);
  }
  return { truncated: true };
}

const RATE_LIMITED_MESSAGE = "You've sent several reports recently. Try again later.";
const GENERIC_MESSAGE = "Couldn't send your report. Try again.";

export function mapReportError(error: unknown): string {
  const status =
    typeof error === 'object' && error !== null
      ? (error as { response?: { status?: unknown } }).response?.status
      : undefined;
  return status === 429 ? RATE_LIMITED_MESSAGE : GENERIC_MESSAGE;
}
