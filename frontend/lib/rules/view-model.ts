/** Pure UI copy helpers for the cook-from-pantry screen (UI-SPEC copywriting contract). */

import { formatExpiryLabel } from '../pantry/expiry';
import { formatAmount, unitLabel } from './format-amount';
import type { IngredientMatch, RankedRecipe } from './types';

export interface RowPill {
  readonly kind: 'ready' | 'missing' | 'expiring';
  readonly label: string;
}

export interface RowViewModel {
  readonly coverageText: string;
  readonly pills: readonly RowPill[];
  readonly progressLabel: string;
}

export function buildRowViewModel(r: RankedRecipe): RowViewModel {
  const status: RowPill =
    r.totalCount === 0
      ? { kind: 'missing', label: 'No ingredients listed' }
      : r.readyToCook
        ? { kind: 'ready', label: 'Ready to cook' }
        : { kind: 'missing', label: `Missing ${r.missingCount}` };
  const expiring: RowPill[] = r.expiringUsed.map((e) => ({
    kind: 'expiring',
    label: `Uses expiring: ${e.name} (${formatExpiryLabel(e.daysLeft)})`,
  }));
  return {
    coverageText:
      r.totalCount === 0
        ? 'No ingredients to compare'
        : `You have ${r.haveCount} of ${r.totalCount} ingredients`,
    pills: [status, ...expiring],
    progressLabel: `${Math.round(r.coveragePercent)}% of ingredients in pantry`,
  };
}

function amount(value: number, unit: string): string {
  const label = unitLabel(unit, value);
  const qty = formatAmount(value, unit);
  return label === '' ? qty : `${qty} ${label}`;
}

const NO_AMOUNT = 'amount not specified';

export function formatMatchLine(m: IngredientMatch): string {
  if (m.needed <= 0) {
    if (m.status === 'staple') return 'pantry staple';
    return m.have > 0 ? `${NO_AMOUNT}, have ${amount(m.have, m.haveUnit)}` : NO_AMOUNT;
  }
  switch (m.status) {
    case 'have':
      return `need ${amount(m.needed, m.unit)}, have ${amount(m.have, m.haveUnit)}`;
    case 'partial':
      return `need ${amount(m.needed, m.unit)}, have ${amount(m.have, m.haveUnit)} (short ${amount(
        Math.max(0, m.needed - m.have),
        m.unit
      )})`;
    case 'unitMismatch':
      return `have ${amount(m.have, m.haveUnit)} (different unit)`;
    case 'staple':
      return 'pantry staple';
    default:
      return `need ${amount(m.needed, m.unit)}`;
  }
}

export function dietSummary(restrictions: readonly string[]): string | null {
  if (restrictions.length === 0) return null;
  return `Diet: ${restrictions.map((r) => r.replace(/_/g, ' ')).join(', ')}`;
}

export function substituteContextLine(m: IngredientMatch): string {
  if (m.needed <= 0) return `Recipe uses ${m.name} (${NO_AMOUNT}).`;
  return `Recipe needs ${amount(m.needed, m.unit)} ${m.name}.`;
}

/** Live-region text for result changes. Loading is announced by the skeleton's own status role. */
export function resultsAnnouncement(status: string, count: number): string {
  switch (status) {
    case 'ready':
      return count === 1 ? '1 recipe' : `${count} recipes`;
    case 'filteredOut':
      return 'Nothing matches your filters';
    case 'error':
      return "Couldn't work out what you can cook";
    default:
      return '';
  }
}

export function truncationNote(total: number, shown: number): string | null {
  return shown < total ? `Showing top ${shown} of ${total} recipes.` : null;
}
