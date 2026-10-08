/**
 * Tolerant JSON extraction for LLM output.
 *
 * Handles reasoning models that prefix "<think>...</think>" (live MiniMax
 * shape), markdown code fences, and surrounding prose.
 */

export class JsonExtractError extends Error {
  constructor(message = 'No parseable JSON found in model output') {
    super(message);
    Object.setPrototypeOf(this, JsonExtractError.prototype);
  }
}

const CLOSED_THINK = /<think>[\s\S]*?<\/think>/gi;
const OPEN_THINK = /<think>[\s\S]*$/i;
const CLOSE_TAG = /<\/think>/gi;

/** Removes reasoning blocks: closed ones, an unterminated tail, stray closers. */
export function stripReasoning(text: string): string {
  const withoutClosed = text.replace(CLOSED_THINK, '');
  const withoutOpen = withoutClosed.replace(OPEN_THINK, '');
  const closers = [...withoutOpen.matchAll(CLOSE_TAG)];
  if (closers.length === 0) return withoutOpen;
  const last = closers[closers.length - 1];
  return withoutOpen.slice((last.index ?? 0) + last[0].length);
}

/** Index one past the end of the balanced value starting at `start`, or -1. */
function findBalancedEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

export interface ExtractJsonOptions {
  /** Try object candidates before array candidates (for object schemas). */
  readonly prefer?: 'object';
}

function tryParseAt(text: string, start: number): { value: unknown } | null {
  const end = findBalancedEnd(text, start);
  if (end === -1) return null;
  try {
    return { value: JSON.parse(text.slice(start, end)) };
  } catch {
    return null;
  }
}

function candidateStarts(text: string, opener: RegExp): number[] {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (opener.test(text[i])) starts.push(i);
  }
  return starts;
}

/**
 * Returns the first bracket-started value that balances and parses. Code
 * fences are plain prose outside JSON, so they are left in place (stripping
 * them would corrupt backticks inside JSON strings).
 */
export function extractJson(text: string, options: ExtractJsonOptions = {}): unknown {
  const cleaned = stripReasoning(text);
  const passes =
    options.prefer === 'object' ? [/\{/, /[{[]/] : [/[{[]/];
  for (const opener of passes) {
    for (const start of candidateStarts(cleaned, opener)) {
      const parsed = tryParseAt(cleaned, start);
      if (parsed) return parsed.value;
    }
  }
  throw new JsonExtractError();
}
