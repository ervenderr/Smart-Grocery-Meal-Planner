/**
 * Prompt hygiene: user-controlled strings only ever reach the model inside
 * delimited data blocks, stripped of anything that could close the block.
 */

// eslint-disable-next-line no-control-regex -- intentionally matching control characters
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const DELIMITER_CHARS = /[<>`]/g;

export function sanitizeForPrompt(s: string, maxLen = 100): string {
  return s
    .replace(CONTROL_CHARS, ' ')
    .replace(DELIMITER_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function toDataBlock(tag: string, lines: readonly string[], maxItems = 60): string {
  const body = lines
    .slice(0, maxItems)
    .map((line) => sanitizeForPrompt(line))
    .filter((line) => line.length > 0);
  return [`<${tag}>`, ...body, `</${tag}>`].join('\n');
}
