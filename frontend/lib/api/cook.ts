import { apiClient } from './client';
import { API_ROUTES } from '@/lib/constants/api-routes';
import type {
  CookApplyResult,
  CookDeduction,
  CookPreview,
  CookTarget,
} from '@/types/cook.types';

/** Cook API (/api/v1/cook). Errors propagate to the caller. */
export const cookApi = {
  preview: async (target: CookTarget, servings?: number): Promise<CookPreview> => {
    return apiClient.post<CookPreview>(API_ROUTES.COOK.PREVIEW, {
      ...target,
      ...(servings !== undefined ? { servings } : {}),
    });
  },

  apply: async (
    target: CookTarget,
    deductions: readonly CookDeduction[]
  ): Promise<CookApplyResult> => {
    return apiClient.post<CookApplyResult>(API_ROUTES.COOK.APPLY, { ...target, deductions });
  },
};
