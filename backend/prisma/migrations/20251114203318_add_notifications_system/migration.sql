-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "action_url" TEXT,
    "metadata" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_is_dismissed_idx" ON "notifications"("user_id", "is_read", "is_dismissed");

-- CreateIndex
CREATE INDEX "notifications_notification_type_idx" ON "notifications"("notification_type");

-- CreateIndex
CREATE INDEX "notifications_scheduled_for_idx" ON "notifications"("scheduled_for");

-- CreateIndex
CREATE INDEX "notifications_priority_idx" ON "notifications"("priority");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
