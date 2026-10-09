-- AlterTable
ALTER TABLE "pantry_items" ADD COLUMN     "barcode" TEXT;

-- CreateIndex
CREATE INDEX "pantry_items_user_id_barcode_idx" ON "pantry_items"("user_id", "barcode");

