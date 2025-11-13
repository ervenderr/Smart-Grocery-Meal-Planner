/*
  Warnings:

  - The `instructions` column on the `recipes` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `category` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `difficulty` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `recipes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "dietary_restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "difficulty" TEXT NOT NULL,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "user_id" TEXT NOT NULL,
DROP COLUMN "instructions",
ADD COLUMN     "instructions" TEXT[];

-- CreateIndex
CREATE INDEX "recipes_user_id_idx" ON "recipes"("user_id");

-- CreateIndex
CREATE INDEX "recipes_category_idx" ON "recipes"("category");

-- CreateIndex
CREATE INDEX "recipes_difficulty_idx" ON "recipes"("difficulty");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
