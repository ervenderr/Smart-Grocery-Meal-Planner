export const PAGE_LIMIT = 100;
export const MAX_PAGES = 50;

type Page<T> = { items: T[]; pagination: { totalPages: number } };

/** Pages through every row of a paginated endpoint (server caps `limit` at 100). */
export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<Page<T>>,
  opts: { limit?: number; maxPages?: number } = {},
): Promise<T[]> {
  const limit = opts.limit ?? PAGE_LIMIT;
  const maxPages = opts.maxPages ?? MAX_PAGES;
  let collected: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchPage(page, limit);
    const items = response.items ?? [];
    collected = [...collected, ...items];
    if (page >= (response.pagination?.totalPages ?? 0) || items.length < limit) {
      return collected;
    }
  }
  throw new Error(`fetchAllPages exceeded ${maxPages} pages`);
}
