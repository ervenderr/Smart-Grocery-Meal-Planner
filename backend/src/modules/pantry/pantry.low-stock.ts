/**
 * Low-stock notification shared by quick-edit PATCH and delta adjust.
 */

import { logger } from "../../config/logger.config";
import { zapierService } from "../zapier";

// Items at or below this quantity (and above 0) trigger a stock_low event
export const LOW_STOCK_THRESHOLD = 2;

export interface LowStockItem {
  readonly id: string;
  readonly ingredientName: string;
  readonly quantity: unknown;
  readonly unit: string;
}

/**
 * Fire-and-forget Zapier stock_low dispatch.
 * Quantity 0 (used up) intentionally does not fire.
 */
export function notifyLowStock(userId: string, item: LowStockItem): void {
  const currentQuantity = Number(item.quantity);
  if (!(currentQuantity <= LOW_STOCK_THRESHOLD && currentQuantity > 0)) {
    return;
  }
  zapierService
    .dispatchEvent(userId, "stock_low", {
      itemId: item.id,
      itemName: item.ingredientName,
      currentQuantity,
      unit: item.unit,
      threshold: LOW_STOCK_THRESHOLD,
      message: `${item.ingredientName} is running low (${currentQuantity} ${item.unit} remaining)`,
    })
    .catch((error) => {
      logger.warn("Failed to dispatch Zapier event for low stock", {
        service: "kitcha-api",
        error: error instanceof Error ? error.message : "Unknown error",
        itemId: item.id,
      });
    });
}
