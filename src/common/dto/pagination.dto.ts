import { z } from "zod";

import {
  PAGINATION_DEFAULTS,
  SortDirection,
} from "@/common/dto/pagination.constants";

/**
 * Zod schema for the common `page`/`limit`/`sortDirection` query params.
 * List endpoints extend it (`paginationQuerySchema.extend({...})`) and wrap
 * the result in `createZodDto`; see `modules/notes/dto/list-notes-query.dto.ts`.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULTS.PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_DEFAULTS.MAX_LIMIT)
    .default(PAGINATION_DEFAULTS.LIMIT),
  sortDirection: z.enum(SortDirection).default(SortDirection.DESC),
});
