import { createZodDto } from "nestjs-zod";

import { noteInputSchema } from "@/modules/notes/dto/create-note.dto";

/** Zod schema for updating a note. All fields are optional. */
const updateNoteSchema = noteInputSchema.partial();

/** Request body DTO for updating a note. */
export class UpdateNoteDto extends createZodDto(updateNoteSchema) {}
