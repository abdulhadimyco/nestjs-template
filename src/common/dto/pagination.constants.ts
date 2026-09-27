/** Sort direction accepted by paginated list endpoints. */
export const SortDirection = {
  ASC: "asc",
  DESC: "desc",
} as const;

/** The type of a {@link SortDirection} value. */
export type SortDirectionValue =
  (typeof SortDirection)[keyof typeof SortDirection];

/** Default and maximum page size for paginated list endpoints. */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
