import { foodApi } from '@/lib/api/food';
import { pantryApi } from '@/lib/api/pantry';
import type { ResolveDeps } from '@/lib/scan/resolve-barcode';

/** Plain API deps: used on web and whenever the offline runtime is absent. */
export const onlineScanDeps: ResolveDeps = {
  findOwn: async (barcode: string) => {
    const response = await pantryApi.getAll({
      barcode,
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    return response.items[0] ?? null;
  },
  lookup: (barcode: string) => foodApi.lookupBarcode(barcode),
};
