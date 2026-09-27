import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { NotesController } from "@/modules/notes/notes.controller";
import { NotesRepository } from "@/modules/notes/notes.repository";
import { NotesService } from "@/modules/notes/notes.service";
import { Note, NoteSchema } from "@/modules/notes/schemas/note.schema";

/**
 * Wires up the notes reference module. Only {@link NotesService} is
 * exported: other modules inject the service, never `NotesRepository` or
 * the `Note` model directly — data access stays private to this module.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Note.name, schema: NoteSchema }]),
  ],
  controllers: [NotesController],
  providers: [NotesRepository, NotesService],
  exports: [NotesService],
})
export class NotesModule {}
