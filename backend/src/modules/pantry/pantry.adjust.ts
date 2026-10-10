/**
 * Delta-based pantry quantity adjustment (SYNC-02).
 *
 * Queued offline taps are sent as deltas and applied under the per-user
 * pantry lock with Decimal math, clamped to [0, PANTRY_QUANTITY_MAX].
 */

import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../config/database.config";
import { AppError } from "../../middleware/errorHandler";
import { PantryItemResponse } from "../../types/pantry.types";
import { familyKey, fromBase, resolveUnit, toBase } from "../intelligence/units";
import { formatPantryItem } from "./pantry.format";
import { lockUserPantry } from "./pantry.lock";
import { notifyLowStock } from "./pantry.low-stock";

export const PANTRY_QUANTITY_MAX = 99999;

export interface AdjustInput {
  readonly delta: string | number;
  readonly unit?: string;
}

export type AdjustResult = PantryItemResponse & { readonly clamped: boolean };

function convertDelta(delta: Decimal, itemUnit: string, inputUnit?: string): Decimal {
  if (!inputUnit) return delta;
  const from = resolveUnit(inputUnit);
  const to = resolveUnit(itemUnit);
  if (from.unitKey === to.unitKey) return delta;
  if (familyKey(from) !== familyKey(to)) {
    throw new AppError(
      `Cannot adjust ${itemUnit} item with unit ${inputUnit}`,
      400,
      true,
      { code: "UNIT_MISMATCH" }
    );
  }
  return fromBase(toBase(delta, from), to.unitKey);
}

export async function adjustPantryItem(
  userId: string,
  itemId: string,
  input: AdjustInput
): Promise<AdjustResult> {
  const { row, clamped } = await prisma.$transaction(async (tx) => {
    await lockUserPantry(tx, userId);

    const current = await tx.pantryItem.findFirst({
      where: { id: itemId, userId, deletedAt: null },
    });
    if (!current) {
      throw new AppError("Pantry item not found", 404);
    }

    const delta = convertDelta(new Decimal(String(input.delta)), current.unit, input.unit);
    const raw = new Decimal(current.quantity.toString()).plus(delta);
    const bounded = Decimal.min(Decimal.max(raw, 0), PANTRY_QUANTITY_MAX);
    const next = bounded.toDecimalPlaces(2);

    const updated = await tx.pantryItem.update({
      where: { id: itemId },
      data: { quantity: next },
    });
    return { row: updated, clamped: !bounded.equals(raw) };
  });

  notifyLowStock(userId, row);
  return { ...formatPantryItem(row), clamped };
}
