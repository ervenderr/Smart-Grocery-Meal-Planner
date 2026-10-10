import { apiClient } from './client';

export const accountApi = {
  /** Permanently deletes the signed-in account. The password is re-verified server side. */
  async deleteAccount(password: string): Promise<void> {
    await apiClient.delete('/api/v1/users/me', { data: { password } });
  },
};
