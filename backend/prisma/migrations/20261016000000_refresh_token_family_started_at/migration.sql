-- AlterTable (additive, nullable: legacy rows fall back to created_at)
ALTER TABLE "refresh_tokens" ADD COLUMN "family_started_at" TIMESTAMP(3);
