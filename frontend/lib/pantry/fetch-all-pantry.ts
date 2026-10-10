/**
 * Pages through every pantry row (the server defaults to 50 per page and caps
 * `limit` at 100). Intentionally a small local copy: it does not reuse the
 * pager under lib/rules, which belongs to Phase 9.
 */
export const PANTRY_PAGE_LIMIT = 100;
export const PANTRY_MAX_PAGES = 50;

type PantryPage<T> = { items: T[]; pagination: { totalPages: number } };

export async function fetchAllPantryItems<T>(
  fetchPage: (page: number, limit: number) => Promise<PantryPage<T>>,
): Promise<T[]> {
  let collected: T[] = [];
  for (let page = 1; page <= PANTRY_MAX_PAGES; page += 1) {
    const response = await fetchPage(page, PANTRY_PAGE_LIMIT);
    const items = response.items ?? [];
    collected = [...collected, ...items];
    const lastPage = page >= (response.pagination?.totalPages ?? 0);
    if (lastPage || items.length < PANTRY_PAGE_LIMIT) break;
  }
  return collected;
}
