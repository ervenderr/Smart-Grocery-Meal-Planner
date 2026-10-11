-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" VARCHAR(100) NOT NULL,
    "original_transaction_id" VARCHAR(40) NOT NULL,
    "latest_transaction_id" VARCHAR(40) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" INTEGER,
    "last_signed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_store_notifications" (
    "notification_uuid" VARCHAR(64) NOT NULL,
    "notification_type" VARCHAR(40) NOT NULL,
    "subtype" VARCHAR(40),
    "environment" VARCHAR(16) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_store_notifications_pkey" PRIMARY KEY ("notification_uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_user_id_product_id_key" ON "entitlements"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_environment_original_transaction_id_key" ON "entitlements"("environment", "original_transaction_id");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
