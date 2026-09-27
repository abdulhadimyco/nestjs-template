import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { NoteStatus } from "@/modules/notes/notes.constants";

/**
 * A note as returned by detail reads — mirrors `NOTE_PROJECTIONS.DETAIL` plus
 * the lean document's `_id`. Used only to document responses in OpenAPI; the
 * runtime value is the repository's lean result.
 */
const noteResponseSchema = z.object({
  _id: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.enum(NoteStatus),
  ownerId: z.string(),
});

/** Response DTO for a single note (OpenAPI documentation only). */
export class NoteResponseDto extends createZodDto(noteResponseSchema) {}
