/**
 * Client-id create replay guard (WR-07).
 *
 * A replayed create (same client id, same owner) is only a true replay when the
 * request still describes the row that was created. If the row has since been
 * modified (updatedAt moved past createdAt) a stale create replay is legitimate
 * and is not compared. Only fields the request supplied are compared.
 */

const UNMODIFIED_TOLERANCE_MS = 1000;

export interface ReplayFields {
  readonly name: string;
  readonly quantity?: number;
  readonly unit?: string;
}

export interface ExistingRow {
  readonly name: string;
  readonly quantity: { toNumber(): number } | number;
  readonly unit: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const normalise = (value: string): string => value.trim().toLowerCase();

export function replayMatchesOriginal(existing: ExistingRow, incoming: ReplayFields): boolean {
  const modified =
    existing.updatedAt.getTime() - existing.createdAt.getTime() > UNMODIFIED_TOLERANCE_MS;
  if (modified) return true;

  if (normalise(existing.name) !== normalise(incoming.name)) return false;
  if (incoming.unit !== undefined && normalise(existing.unit) !== normalise(incoming.unit)) {
    return false;
  }
  if (incoming.quantity !== undefined) {
    const stored =
      typeof existing.quantity === 'number' ? existing.quantity : existing.quantity.toNumber();
    if (Math.abs(stored - incoming.quantity) > 0.005) return false;
  }
  return true;
}
