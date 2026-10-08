-- Idempotent: the table may already exist on databases created via `prisma db push`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "zapier_webhooks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zapier_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "zapier_webhooks_user_id_idx" ON "zapier_webhooks"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "zapier_webhooks_event_type_idx" ON "zapier_webhooks"("event_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "zapier_webhooks_user_id_event_type_is_active_idx" ON "zapier_webhooks"("user_id", "event_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "zapier_webhooks_user_id_event_type_key" ON "zapier_webhooks"("user_id", "event_type");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'zapier_webhooks_user_id_fkey'
    ) THEN
        ALTER TABLE "zapier_webhooks" ADD CONSTRAINT "zapier_webhooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
