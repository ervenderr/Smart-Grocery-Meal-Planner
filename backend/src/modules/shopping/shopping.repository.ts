/**
 * Shopping repository: race-safe access to the user's single active list.
 *
 * Relies on the partial unique index shopping_lists_one_active_per_user.
 * Tagged templates only; never the *Unsafe raw variants.
 */

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import type { ShoppingListDto } from '../../types/shopping.types';
import { DEFAULT_LIST_NAME } from './shopping.constants';
import { toListDto } from './shopping.dto';

const MAX_ACTIVE_LIST_ATTEMPTS = 2;

export const findActiveListIdForUpdate = async (
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<string | null> => {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM shopping_lists
    WHERE user_id = ${userId} AND is_completed = false AND deleted_at IS NULL
    FOR UPDATE`;
  return rows.length > 0 ? rows[0].id : null;
};

/**
 * Returns the id of the user's active list (creating it if needed) and holds
 * a row lock on it for the rest of the transaction. If a concurrent finish
 * completes the locked row, the insert+select pair is retried once with a
 * fresh statement snapshot.
 */
export const ensureActiveListId = async (
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<string> => {
  for (let attempt = 0; attempt < MAX_ACTIVE_LIST_ATTEMPTS; attempt += 1) {
    await tx.$executeRaw`
      INSERT INTO shopping_lists (id, user_id, name, updated_at)
      VALUES (${randomUUID()}, ${userId}, ${DEFAULT_LIST_NAME}, now())
      ON CONFLICT (user_id) WHERE is_completed = false AND deleted_at IS NULL DO NOTHING`;
    const id = await findActiveListIdForUpdate(tx, userId);
    if (id) return id;
  }
  throw new AppError('Could not open your shopping list. Try again.', 500);
};

export const loadListDto = async (
  tx: Prisma.TransactionClient,
  listId: string,
): Promise<ShoppingListDto> => {
  const list = await tx.shoppingList.findUniqueOrThrow({ where: { id: listId } });
  const items = await tx.shoppingListItem.findMany({
    where: { shoppingListId: listId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return toListDto(list, items);
};

/**
 * Sets many item quantities in ONE statement (UPDATE ... FROM (VALUES ...)),
 * scoped to the given list. Callers hold the list row lock. Values are bound
 * parameters; nothing is interpolated into the SQL text.
 */
export const bulkUpdateQuantities = async (
  tx: Prisma.TransactionClient,
  listId: string,
  updates: ReadonlyArray<{ readonly id: string; readonly quantity: number }>,
): Promise<void> => {
  if (updates.length === 0) return;
  const values = Prisma.join(
    updates.map((u) => Prisma.sql`(${u.id}::text, ${u.quantity.toFixed(2)}::numeric(10,2))`),
  );
  await tx.$executeRaw`
    UPDATE shopping_list_items AS item
    SET quantity = v.quantity, updated_at = now()
    FROM (VALUES ${values}) AS v(id, quantity)
    WHERE item.id = v.id AND item.shopping_list_id = ${listId}`;
};
