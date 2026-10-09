-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "staple_names" TEXT[] DEFAULT ARRAY['salt', 'black pepper', 'pepper', 'water', 'sugar', 'flour', 'all purpose flour', 'cooking oil', 'vegetable oil', 'olive oil', 'baking soda', 'baking powder', 'cornstarch', 'vinegar', 'soy sauce']::TEXT[];

