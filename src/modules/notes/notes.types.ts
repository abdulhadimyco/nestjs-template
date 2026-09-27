import type { Lean } from "@/common/mongo/lean.types";

import type { NoteStatusValue } from "@/modules/notes/notes.constants";
import type { Note } from "@/modules/notes/schemas/note.schema";

/**
 * A note detail as `NotesRepository` returns it: straight off Mongo, so
 * `_id` is a real `Types.ObjectId`.
 */
export type NoteDetailRecord = Lean<
  Pick<Note, "title" | "body" | "status" | "ownerId">
>;

/**
 * A note list item as `NotesRepository` returns it: straight off Mongo, so
 * `_id` is a real `Types.ObjectId`.
 */
export type NoteListItemRecord = Lean<
  Pick<Note, "title" | "status" | "ownerId">
>;

/**
 * A note detail as `NotesService` returns it to callers and caches it.
 * `_id` is a plain `string`: it is what a JSON cache round-trip actually
 * gives back, so the type says so instead of claiming an `ObjectId` that
 * only ever holds true on a fresh, uncached read.
 */
export type NoteDetail = Omit<NoteDetailRecord, "_id"> & { _id: string };

/** A note list item as `NotesService` returns it. See {@link NoteDetail}. */
export type NoteListItem = Omit<NoteListItemRecord, "_id"> & { _id: string };

/** The fields {@link NotesRepository.create} accepts. */
export type CreateNoteInput = {
  title: string;
  body: string;
  status: NoteStatusValue;
  ownerId: string;
};

/**
 * The fields {@link NotesRepository.updateByIdForOwner} accepts. All are
 * optional.
 */
export type UpdateNoteInput = Partial<Omit<CreateNoteInput, "ownerId">>;
