import { apiClient } from './client';

export type EntitlementStatus = 'active' | 'revoked' | 'none';

export interface EntitlementMe {
  status: EntitlementStatus;
  productId: string;
  environment: 'Sandbox' | 'Production' | 'Xcode' | null;
  purchasedAt: string | null;
  revokedAt: string | null;
  limits: { pantry: number | null; aiDaily: number; aiMonthly: number | null };
}

export interface VerifyResult {
  status: 'active' | 'revoked';
  productId: string;
  environment: string;
  purchasedAt: string;
}

export const ENTITLEMENT_QUERY_KEY = ['entitlements', 'me'] as const;

const BASE = '/api/v1/entitlements';

export const entitlementsApi = {
  me: (): Promise<EntitlementMe> => apiClient.get<EntitlementMe>(`${BASE}/me`),
  verify: (signedTransaction: string, idempotencyKey: string): Promise<VerifyResult> =>
    apiClient.post<VerifyResult>(
      `${BASE}/verify`,
      { signedTransaction },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    ),
};
