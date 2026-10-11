-- CreateTable
-- Refund/revoke tombstones for purchases (CR-01): kept even when no account has
-- claimed the purchase yet, so a later claim of a saved JWS cannot reactivate it.
CREATE TABLE "app_store_revocations" (
    "environment" VARCHAR(16) NOT NULL,
    "original_transaction_id" VARCHAR(40) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" INTEGER,
    "last_signed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_store_revocations_pkey" PRIMARY KEY ("environment","original_transaction_id")
);
