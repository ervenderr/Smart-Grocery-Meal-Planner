-- Phase 04: guarantee at most one active shopping list per user.
--
-- Prisma 5.22 cannot model partial indexes and ignores them in `migrate diff`,
-- so this index is hand-written and only documented in schema.prisma.
-- Additive: pre-existing duplicate active lists are completed (never deleted).

-- (a) Complete every active list except the most recently updated one per user.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id) AS rn
    FROM "shopping_lists"
    WHERE "is_completed" = false AND "deleted_at" IS NULL
)
UPDATE "shopping_lists" AS sl
SET "is_completed" = true,
    "completed_at" = now(),
    "updated_at" = now()
FROM ranked
WHERE sl."id" = ranked.id AND ranked.rn > 1;

-- (b) Enforce the invariant in the database.
CREATE UNIQUE INDEX IF NOT EXISTS "shopping_lists_one_active_per_user"
    ON "shopping_lists" ("user_id")
    WHERE "is_completed" = false AND "deleted_at" IS NULL;
