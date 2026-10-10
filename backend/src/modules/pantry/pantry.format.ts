/**
 * Pantry item response formatter shared by PantryService and sync bootstrap.
 */

import type { PantryItem } from "@prisma/client";
import type { PantryItemResponse } from "../../types/pantry.types";

export function formatPantryItem(item: PantryItem): PantryItemResponse {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let isExpired = false;
  let daysUntilExpiry: number | null = null;

  if (item.expiryDate) {
    const expiryDate = new Date(item.expiryDate);
    expiryDate.setUTCHours(0, 0, 0, 0);

    isExpired = expiryDate < today;

    if (!isExpired) {
      const diffTime = expiryDate.getTime() - today.getTime();
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  }

  return {
    id: item.id,
    userId: item.userId,
    ingredientName: item.ingredientName,
    quantity: item.quantity.toString(),
    unit: item.unit,
    category: item.category,
    expiryDate: item.expiryDate
      ? item.expiryDate.toISOString().split("T")[0]
      : null,
    purchaseDate: item.purchaseDate
      ? item.purchaseDate.toISOString().split("T")[0]
      : null,
    purchasePriceCents: item.purchasePriceCents,
    location: item.location,
    notes: item.notes,
    barcode: item.barcode ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    isExpired,
    daysUntilExpiry,
  };
}
