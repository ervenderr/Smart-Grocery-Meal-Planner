/**
 * Unit normalization for shopping items.
 * Known PantryUnit values are canonicalised; other short plain text is kept.
 */

import { PantryUnit } from '../../types/pantry.types';
import { DEFAULT_UNIT, MAX_UNIT_LENGTH, UNIT_TEXT_PATTERN } from './shopping.constants';

const KNOWN_UNITS: ReadonlyMap<string, string> = new Map(
  (Object.values(PantryUnit) as string[]).map((u) => [u.toLowerCase(), u]),
);

const UNIT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  pcs: PantryUnit.PIECES,
  pc: PantryUnit.PIECES,
  piece: PantryUnit.PIECES,
});

const collapse = (raw: string): string => raw.replace(/\s+/g, ' ').trim();

export function normalizeUnit(raw: string): string | null {
  const text = collapse(raw);
  if (text.length === 0 || text.length > MAX_UNIT_LENGTH) return null;
  const lower = text.toLowerCase();
  const known = KNOWN_UNITS.get(lower) ?? UNIT_ALIASES[lower];
  if (known) return known;
  return UNIT_TEXT_PATTERN.test(text) ? text : null;
}

export function coerceUnit(raw: string): string {
  const valid = normalizeUnit(raw);
  if (valid) return valid;
  const cleaned = collapse(
    raw.replace(/[^\p{L}\p{N} .%/\-\s]/gu, '').replace(/\s+/g, ' '),
  )
    .slice(0, MAX_UNIT_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : DEFAULT_UNIT;
}
