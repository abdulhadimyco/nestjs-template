import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

import type { Projection } from "@/common/mongo/lean.types";

import type { NoteStatusValue } from "@/modules/notes/notes.constants";
import { NOTES_COLLECTION, NoteStatus } from "@/modules/notes/notes.constants";

/** A note document, as stored in the `notes` collection. */
@Schema({ collection: NOTES_COLLECTION, timestamps: true })
export class Note {
  @Prop({ type: String, required: true })
  public title!: string;

  @Prop({ type: String, required: true })
  public body!: string;

  @Prop({ type: String, enum: Object.values(NoteStatus), required: true })
  public status!: NoteStatusValue;

  @Prop({ type: String, required: true })
  public ownerId!: string;
}

/** The Mongoose schema built from {@link Note}. */
export const NoteSchema = SchemaFactory.createForClass(Note);

// Declared, not auto-created: index creation is a reviewed Atlas step (see
// MongoModule), never a side effect of the app booting.
// eslint-disable-next-line unicorn/no-top-level-side-effects -- declaring an index on the schema is the standard Mongoose pattern; MongoModule disables autoIndex so this never runs against the database at boot.
NoteSchema.index({ ownerId: 1, status: 1, createdAt: -1 });

/** Field projections used by the notes module's queries. */
export const NOTE_PROJECTIONS = {
  LIST: { title: 1, status: 1, ownerId: 1 },
  DETAIL: { title: 1, body: 1, status: 1, ownerId: 1 },
} as const satisfies Record<string, Projection<Note>>;
