import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.dto";

import { NoteStatus } from "@/modules/notes/notes.constants";

/** Zod schema for listing notes: pagination plus an optional status filter. */
const listNotesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(NoteStatus).optional(),
});

/** Query DTO for listing notes. */
export class ListNotesQueryDto extends createZodDto(listNotesQuerySchema) {}
