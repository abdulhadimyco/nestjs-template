/** Lifecycle status of a note. */
export const NoteStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

/** The type of a {@link NoteStatus} value. */
export type NoteStatusValue = (typeof NoteStatus)[keyof typeof NoteStatus];

/** The Mongo collection notes are stored in. */
export const NOTES_COLLECTION = "notes";

/** Maximum length of a note's title. */
export const NOTE_TITLE_MAX_LENGTH = 200;

/** Maximum length of a note's body. */
export const NOTE_BODY_MAX_LENGTH = 5000;
