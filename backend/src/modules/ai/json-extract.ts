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

function stripFences(text: string): string {
  return text.replace(/```(?:json)?/gi, '');
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

export function extractJson(text: string): unknown {
  const cleaned = stripFences(stripReasoning(text));
  const start = cleaned.search(/[{[]/);
  if (start === -1) throw new JsonExtractError();
  const end = findBalancedEnd(cleaned, start);
  if (end === -1) throw new JsonExtractError();
  try {
    return JSON.parse(cleaned.slice(start, end));
  } catch {
    throw new JsonExtractError();
  }
}
