/**
 * Exact grouping of ingredient lines by canonical name + unit family.
 * Pure and immutable: inputs are never mutated, every accumulation step
 * replaces the group with a new object. Sums happen in base units.
 */

import { canonicalName } from './canonical';
import { Dec, ZERO } from './quantity';
import { UnitFamily, familyKey, resolveUnit, toBase, toDisplay } from './units';

export interface IngredientLine {
  readonly name: string;
  readonly quantity: Dec;
  readonly unit: string;
  readonly source?: string;
}

export interface IngredientGroup {
  readonly key: string;
  readonly canonical: string;
  readonly displayName: string;
  readonly family: UnitFamily;
  readonly countLabel: string;
  readonly baseTotal: Dec;
  readonly inputUnitKeys: readonly string[];
  readonly sources: readonly string[];
}

export function groupKey(name: string, unit: string): string {
  return `${canonicalName(name)}\u0000${familyKey(resolveUnit(unit))}`;
}

const appendDistinct = (list: readonly string[], value: string | undefined): readonly string[] =>
  value && !list.includes(value) ? [...list, value] : list;

const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim();

function newGroup(line: IngredientLine, canonical: string): IngredientGroup {
  const resolved = resolveUnit(line.unit);
  return {
    key: `${canonical}\u0000${familyKey(resolved)}`,
    canonical,
    displayName: cleanName(line.name),
    family: resolved.family,
    countLabel: resolved.family === 'count' ? resolved.label : '',
    baseTotal: toBase(line.quantity, resolved),
    inputUnitKeys: [resolved.unitKey],
    sources: appendDistinct([], line.source?.trim()),
  };
}

function addLine(group: IngredientGroup, line: IngredientLine): IngredientGroup {
  const resolved = resolveUnit(line.unit);
  return {
    ...group,
    baseTotal: group.baseTotal.plus(toBase(line.quantity, resolved)),
    inputUnitKeys: appendDistinct(group.inputUnitKeys, resolved.unitKey),
    sources: appendDistinct(group.sources, line.source?.trim()),
  };
}

export function groupIngredients(lines: readonly IngredientLine[]): IngredientGroup[] {
  const groups = new Map<string, IngredientGroup>();
  for (const line of lines) {
    const canonical = canonicalName(line.name);
    if (!canonical || !line.quantity.gt(ZERO)) continue;
    const key = `${canonical}\u0000${familyKey(resolveUnit(line.unit))}`;
    const existing = groups.get(key);
    groups.set(key, existing ? addLine(existing, line) : newGroup(line, canonical));
  }
  return Array.from(groups.values());
}

export function displayOf(group: IngredientGroup): { quantity: Dec; unit: string } {
  const { unit, quantity } = toDisplay({
    family: group.family,
    countLabel: group.countLabel,
    baseTotal: group.baseTotal,
    inputUnitKeys: group.inputUnitKeys,
  });
  return { quantity, unit };
}

export function withBaseTotal(group: IngredientGroup, baseTotal: Dec): IngredientGroup {
  return { ...group, baseTotal };
}
