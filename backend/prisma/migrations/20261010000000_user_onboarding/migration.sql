-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- BACKFILL: existing users who already use the app are treated as onboarded
UPDATE "user_preferences" up SET "onboarding_completed_at" = NOW() WHERE EXISTS (SELECT 1 FROM "pantry_items" p WHERE p."user_id" = up."user_id") OR up."currency" <> 'PHP' OR up."budget_per_week_cents" <> 10000 OR cardinality(up."dietary_restrictions") > 0 OR up."updated_at" > up."created_at" + interval '1 second';
