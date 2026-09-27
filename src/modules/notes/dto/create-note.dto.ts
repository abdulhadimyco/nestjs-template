import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  NoteStatus,
} from "@/modules/notes/notes.constants";

/** Zod schema for a note's writable fields. */
export const noteInputSchema = z.object({
  title: z.string().min(1).max(NOTE_TITLE_MAX_LENGTH),
  body: z.string().min(1).max(NOTE_BODY_MAX_LENGTH),
  status: z.enum(NoteStatus).default(NoteStatus.DRAFT),
});

/** Request body DTO for creating a note. */
export class CreateNoteDto extends createZodDto(noteInputSchema) {}
