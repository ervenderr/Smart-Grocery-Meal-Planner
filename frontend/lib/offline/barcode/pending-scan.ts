import type { SqlDb } from '../sql/types';

export const MAX_PENDING_ATTEMPTS = 5;

export interface PendingScan {
  pantryItemId: string;
  barcode: string;
  attempts: number;
}

export interface PendingScans {
  add(userId: string, pantryItemId: string, barcode: string): Promise<void>;
  listUnresolved(userId: string): Promise<PendingScan[]>;
  markResolved(pantryItemId: string): Promise<void>;
  bumpAttempts(pantryItemId: string): Promise<void>;
}

export function createPendingScans(args: { db: SqlDb; now?: () => number }): PendingScans {
  const { db } = args;
  const now = args.now ?? Date.now;
  return {
    async add(userId, pantryItemId, barcode) {
      await db.run(
        `INSERT OR REPLACE INTO pending_scan (pantry_item_id, user_id, barcode, created_at, attempts, resolved_at)
         VALUES (?, ?, ?, ?, 0, NULL)`,
        [pantryItemId, userId, barcode, now()]
      );
    },
    async listUnresolved(userId) {
      const rows = await db.query<{ pantry_item_id: string; barcode: string; attempts: number }>(
        `SELECT pantry_item_id, barcode, attempts FROM pending_scan
         WHERE user_id = ? AND resolved_at IS NULL AND attempts < ? ORDER BY created_at`,
        [userId, MAX_PENDING_ATTEMPTS]
      );
      return rows.map((r) => ({ pantryItemId: r.pantry_item_id, barcode: r.barcode, attempts: r.attempts }));
    },
    async markResolved(pantryItemId) {
      await db.run(`UPDATE pending_scan SET resolved_at = ? WHERE pantry_item_id = ?`, [now(), pantryItemId]);
    },
    async bumpAttempts(pantryItemId) {
      await db.run(`UPDATE pending_scan SET attempts = attempts + 1 WHERE pantry_item_id = ?`, [pantryItemId]);
    },
  };
}
