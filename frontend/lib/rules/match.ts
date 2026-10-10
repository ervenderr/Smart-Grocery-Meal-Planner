/**
 * Per-ingredient resolution for the ranking engine: groups recipe lines by
 * canonical name and resolves each group against the pantry index.
 * Pure and total: never throws on malformed rows.
 */
import { canonicalName } from '@/lib/preferences/canonical';
import type { PantryEntry, PantryIndex } from './pantry-index';
import type { IngredientMatch, MatchStatus, RulesContext, RulesRecipeIngredient } from './types';
import { UNIT_EPSILON, familyKey, fromBase, resolveUnit, toBase } from './units';
import type { ResolvedUnit } from './types';

export interface NeedFamily {
  readonly unit: ResolvedUnit;
  readonly base: number;
}

export interface NeedGroup {
  readonly canonical: string;
  readonly displayName: string;
  /** Needed families in first-seen order; empty when no line had a usable quantity. */
  readonly families: ReadonlyMap<string, NeedFamily>;
  /** Unit of the first line, used to label unknown-quantity needs. */
  readonly firstUnit: ResolvedUnit;
  readonly discreteCount: boolean;
}

export interface Resolution {
  readonly match: IngredientMatch;
  /** Coverage credit in [0, 1]. */
  readonly credit: number;
}

const isDiscrete = (u: ResolvedUnit): boolean => u.family === 'count' && u.unitKey === 'pieces';

export function groupNeeds(lines: readonly RulesRecipeIngredient[]): readonly NeedGroup[] {
  const groups = new Map<
    string,
    { displayName: string; families: Map<string, NeedFamily>; firstUnit: ResolvedUnit; discrete: boolean }
  >();
  for (const line of lines) {
    const canonical = canonicalName(line.ingredientName);
    if (canonical === '') continue;
    const unit = resolveUnit(line.unit);
    const group = groups.get(canonical) ?? {
      displayName: String(line.ingredientName).trim(),
      families: new Map<string, NeedFamily>(),
      firstUnit: unit,
      discrete: false,
    };
    group.discrete = group.discrete || isDiscrete(unit);
    const qty = Number(line.quantity);
    if (Number.isFinite(qty) && qty > 0) {
      const key = familyKey(unit);
      const prev = group.families.get(key);
      group.families.set(key, {
        unit: prev ? prev.unit : unit,
        base: (prev ? prev.base : 0) + toBase(qty, unit),
      });
    }
    groups.set(canonical, group);
  }
  return [...groups.entries()].map(([canonical, g]) =>
    Object.freeze({
      canonical,
      displayName: g.displayName,
      families: g.families as ReadonlyMap<string, NeedFamily>,
      firstUnit: g.firstUnit,
      discreteCount: g.discrete,
    }),
  );
}

/** Human unit for a pantry family total (base g / ml / count). */
function pantryDisplay(key: string, base: number): { amount: number; unit: string } {
  if (key === 'mass') {
    return base >= 1000 ? { amount: base / 1000, unit: 'kg' } : { amount: base, unit: 'grams' };
  }
  if (key === 'volume') {
    return base >= 1000 ? { amount: base / 1000, unit: 'liters' } : { amount: base, unit: 'ml' };
  }
  return { amount: base, unit: key.startsWith('count:') ? key.slice(6) : key };
}

interface Draft {
  readonly status: MatchStatus;
  readonly needed: number;
  readonly unit: string;
  readonly have: number;
  readonly haveUnit: string;
  readonly credit: number;
}

function firstStock(entry: PantryEntry): { amount: number; unit: string } {
  for (const [key, base] of entry.baseByFamily) return pantryDisplay(key, base);
  return { amount: 0, unit: '' };
}

function resolveWithStock(group: NeedGroup, entry: PantryEntry, quantityAware: boolean): Draft {
  const unitLabel = group.firstUnit.label;
  if (!quantityAware || group.families.size === 0) {
    const stock = firstStock(entry);
    return { status: 'have', needed: 0, unit: unitLabel, have: stock.amount, haveUnit: stock.unit, credit: 1 };
  }
  let best: { ratio: number; need: NeedFamily; haveBase: number } | null = null;
  for (const [key, need] of group.families) {
    const haveBase = entry.baseByFamily.get(key);
    if (haveBase === undefined) continue;
    const ratio = haveBase / need.base;
    if (best === null || ratio < best.ratio) best = { ratio, need, haveBase };
  }
  if (best === null) {
    const stock = firstStock(entry);
    const [, firstNeed] = [...group.families][0];
    return {
      status: 'unitMismatch',
      needed: fromBase(firstNeed.base, firstNeed.unit.unitKey),
      unit: firstNeed.unit.label,
      have: stock.amount,
      haveUnit: stock.unit,
      credit: 1,
    };
  }
  const { ratio, need, haveBase } = best;
  const covered = ratio >= 1 - UNIT_EPSILON;
  return {
    status: covered ? 'have' : 'partial',
    needed: fromBase(need.base, need.unit.unitKey),
    unit: need.unit.label,
    have: fromBase(haveBase, need.unit.unitKey),
    haveUnit: need.unit.label,
    credit: covered ? 1 : Math.max(0, ratio),
  };
}

function resolveWithoutStock(group: NeedGroup, ctx: RulesContext): Draft {
  const first = [...group.families.values()][0];
  const needed = first ? fromBase(first.base, first.unit.unitKey) : 0;
  const unit = first ? first.unit.label : group.firstUnit.label;
  const isStaple = ctx.staples.has(group.canonical) && !group.discreteCount;
  return {
    status: isStaple ? 'staple' : 'missing',
    needed,
    unit,
    have: 0,
    haveUnit: unit,
    credit: isStaple ? 1 : 0,
  };
}

export function resolveMatch(group: NeedGroup, index: PantryIndex, ctx: RulesContext): Resolution {
  const entry = index.entries.get(group.canonical);
  const quantityAware = ctx.quantityAware !== false;
  const draft = entry ? resolveWithStock(group, entry, quantityAware) : resolveWithoutStock(group, ctx);
  const isMissing = draft.status === 'missing' || draft.status === 'partial';
  const match: IngredientMatch = Object.freeze({
    name: group.displayName,
    canonical: group.canonical,
    needed: draft.needed,
    unit: draft.unit,
    have: draft.have,
    haveUnit: draft.haveUnit,
    status: draft.status,
    daysLeft: entry ? entry.minDaysLeft : null,
    hasSubstitute: isMissing && ctx.hasSubstitute ? ctx.hasSubstitute(group.canonical) === true : false,
  });
  return { match, credit: draft.credit };
}
