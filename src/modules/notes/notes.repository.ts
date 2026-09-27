import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { FilterQuery, Model } from "mongoose";
import { Types } from "mongoose";

import type { SortDirectionValue } from "@/common/dto/pagination.constants";
import { BaseRepository } from "@/common/mongo/base.repository";

import type { NoteStatusValue } from "@/modules/notes/notes.constants";
import type {
  CreateNoteInput,
  NoteDetailRecord,
  NoteListItemRecord,
  UpdateNoteInput,
} from "@/modules/notes/notes.types";
import { Note, NOTE_PROJECTIONS } from "@/modules/notes/schemas/note.schema";

/** Page params for {@link NotesRepository.listByOwner}. */
export type NotesPage = {
  skip: number;
  limit: number;
  sortDirection: SortDirectionValue;
};

/**
 * The only place in this module that touches the `Note` Mongoose model.
 * Every public method is intent-named and builds its Mongo filter
 * internally; none of them accept or return a `FilterQuery`/`UpdateQuery`.
 * That is deliberate: it keeps this class as the sole place a future
 * datastore swap would need to change. This repository does no business
 * validation, caching, or error mapping — it returns `null`/`false` on a
 * miss and leaves the decision of what that means to {@link NotesService}.
 */
@Injectable()
export class NotesRepository extends BaseRepository<Note> {
  /**
   * Creates the repository.
   *
   * @param noteModel - The Mongoose model for {@link Note}.
   */
  constructor(@InjectModel(Note.name) noteModel: Model<Note>) {
    super(noteModel);
  }

  /**
   * Creates a note.
   *
   * @param input - The note's fields.
   * @returns The created note, in detail shape.
   */
  public async create(input: CreateNoteInput): Promise<NoteDetailRecord> {
    return this.createOne<NoteDetailRecord>(input, NOTE_PROJECTIONS.DETAIL);
  }

  /**
   * Finds a note by id, scoped to its owner. Every owner-scoped read/write
   * in this repository filters by `{ _id, ownerId }` together — filtering
   * by `_id` alone would let one owner read, update, or delete another
   * owner's note by guessing or reusing an id (an IDOR).
   *
   * @param id - The note's id.
   * @param ownerId - The id of the note's owner.
   * @returns The note in detail shape, or `null` when it does not exist for
   * that owner.
   */
  public async findByIdForOwner(
    id: Types.ObjectId,
    ownerId: string,
  ): Promise<NoteDetailRecord | null> {
    return this.findOne<NoteDetailRecord>(
      { _id: id, ownerId },
      NOTE_PROJECTIONS.DETAIL,
    );
  }

  /**
   * Lists notes owned by a given owner, optionally filtered by status.
   *
   * @param ownerId - The owner to list notes for.
   * @param filter - Optional filters, currently just `status`.
   * @param filter.status - The status to filter by, when given.
   * @param page - Pagination params.
   * @returns The matching page of notes, in list shape, and the total match count.
   */
  public async listByOwner(
    ownerId: string,
    filter: { status?: NoteStatusValue },
    page: NotesPage,
  ): Promise<{ items: NoteListItemRecord[]; total: number }> {
    const mongoFilter: FilterQuery<Note> =
      filter.status === undefined
        ? { ownerId }
        : { ownerId, status: filter.status };
    const sort = { createdAt: page.sortDirection === "asc" ? 1 : -1 } as const;

    const [items, total] = await Promise.all([
      this.findMany<NoteListItemRecord>(mongoFilter, NOTE_PROJECTIONS.LIST, {
        skip: page.skip,
        limit: page.limit,
        sort,
      }),
      this.count(mongoFilter),
    ]);

    return { items, total };
  }

  /**
   * Updates a note by id, scoped to its owner. See {@link findByIdForOwner}
   * for why the owner is always part of the filter.
   *
   * @param id - The note's id.
   * @param ownerId - The id of the note's owner.
   * @param patch - The fields to update.
   * @returns The updated note in detail shape, or `null` when it does not
   * exist for that owner.
   */
  public async updateByIdForOwner(
    id: Types.ObjectId,
    ownerId: string,
    patch: UpdateNoteInput,
  ): Promise<NoteDetailRecord | null> {
    return this.updateOne<NoteDetailRecord>(
      { _id: id, ownerId },
      patch,
      NOTE_PROJECTIONS.DETAIL,
    );
  }

  /**
   * Deletes a note by id, scoped to its owner. See {@link findByIdForOwner}
   * for why the owner is always part of the filter.
   *
   * @param id - The note's id.
   * @param ownerId - The id of the note's owner.
   * @returns True when a note was deleted.
   */
  public async deleteByIdForOwner(
    id: Types.ObjectId,
    ownerId: string,
  ): Promise<boolean> {
    return this.deleteOne({ _id: id, ownerId });
  }
}
