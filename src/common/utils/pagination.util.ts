/** A page of `T` items plus the pagination metadata used to produce it. */
export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

/**
 * Builds a {@link Paginated} response envelope.
 *
 * @param items - The items for the current page.
 * @param page - The 1-based page number requested.
 * @param limit - The page size requested.
 * @param total - The total number of matching items across all pages.
 * @returns The paginated envelope.
 */
export function buildPaginated<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): Paginated<T> {
  return { items, page, limit, total };
}
