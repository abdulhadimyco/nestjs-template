import { Injectable } from "@nestjs/common";

import { CACHE_TTL_SECONDS } from "@/common/cache/cache.constants";
import { CacheService } from "@/common/cache/cache.service";
import { NotFoundError } from "@/common/errors/app.error";
import { parseObjectId } from "@/common/utils/object-id.util";
import type { Paginated } from "@/common/utils/pagination.util";
import { buildPaginated } from "@/common/utils/pagination.util";

import type { CreateNoteDto } from "@/modules/notes/dto/create-note.dto";
import type { ListNotesQueryDto } from "@/modules/notes/dto/list-notes-query.dto";
import type { UpdateNoteDto } from "@/modules/notes/dto/update-note.dto";
import { noteCacheKeys } from "@/modules/notes/notes.cache-keys";
import { NotesRepository } from "@/modules/notes/notes.repository";
import type {
  NoteDetail,
  NoteListItem,
  UpdateNoteInput,
} from "@/modules/notes/notes.types";

/**
 * Converts a repository record (real `ObjectId` `_id`) into the public
 * shape this service returns and caches (`_id` as a plain `string`). Doing
 * this once, here, is what keeps {@link NoteDetail}/{@link NoteListItem}
 * honest about what a cache round-trip actually returns.
 *
 * @param record - The repository's lean result.
 * @returns The same fields with `_id` serialized to a string.
 */
function toPublicNote<T extends { _id: { toString: () => string } }>(
  record: T,
): Omit<T, "_id"> & { _id: string } {
  return { ...record, _id: record._id.toString() };
}

/**
 * Business logic for the notes reference module. Depends only on
 * {@link NotesRepository} and {@link CacheService} — it never imports the
 * `Note` Mongoose model. This is where cache keys/TTLs, `NotFoundError`,
 * and pagination shaping belong; data access and projections belong in the
 * repository.
 */
@Injectable()
export class NotesService {
  /**
   * Creates the notes service.
   *
   * @param notesRepository - The notes repository.
   * @param cache - The shared cache service.
   */
  constructor(
    private readonly notesRepository: NotesRepository,
    private readonly cache: CacheService,
  ) {}

  /**
   * Creates a note.
   *
   * @param ownerId - The id of the note's owner.
   * @param dto - The note fields to create.
   * @returns The created note.
   */
  public async create(
    ownerId: string,
    dto: CreateNoteDto,
  ): Promise<NoteDetail> {
    const created = await this.notesRepository.create({
      title: dto.title,
      body: dto.body,
      status: dto.status,
      ownerId,
    });

    return toPublicNote(created);
  }

  /**
   * Finds a note by id, scoped to its owner, using the cache-aside pattern.
   *
   * @param ownerId - The id of the note's owner.
   * @param id - The note's id.
   * @returns The note.
   * @throws {NotFoundError} When no note with that id exists for that owner.
   */
  public async findById(ownerId: string, id: string): Promise<NoteDetail> {
    const objectId = parseObjectId(id);

    const note = await this.cache.getOrSet(
      noteCacheKeys.byOwnerAndId(ownerId, id),
      CACHE_TTL_SECONDS.DEFAULT,
      async (): Promise<NoteDetail | null> => {
        const record = await this.notesRepository.findByIdForOwner(
          objectId,
          ownerId,
        );
        return record === null ? null : toPublicNote(record);
      },
    );

    if (note === null) {
      throw new NotFoundError(`Note not found: ${id}`);
    }

    return note;
  }

  /**
   * Lists notes owned by the caller, with pagination and an optional status
   * filter.
   *
   * @param ownerId - The id of the owner to list notes for.
   * @param query - The pagination and filter params.
   * @returns The matching page of notes.
   */
  public async list(
    ownerId: string,
    query: ListNotesQueryDto,
  ): Promise<Paginated<NoteListItem>> {
    const skip = (query.page - 1) * query.limit;
    const filter = query.status === undefined ? {} : { status: query.status };

    const { items, total } = await this.notesRepository.listByOwner(
      ownerId,
      filter,
      { skip, limit: query.limit, sortDirection: query.sortDirection },
    );

    return buildPaginated(
      items.map(toPublicNote),
      query.page,
      query.limit,
      total,
    );
  }

  /**
   * Updates a note, scoped to its owner, and invalidates its cached detail
   * entry.
   *
   * @param ownerId - The id of the note's owner.
   * @param id - The note's id.
   * @param dto - The fields to update.
   * @returns The updated note.
   * @throws {NotFoundError} When no note with that id exists for that owner.
   */
  public async update(
    ownerId: string,
    id: string,
    dto: UpdateNoteDto,
  ): Promise<NoteDetail> {
    const objectId = parseObjectId(id);
    const patch: UpdateNoteInput = {
      ...(dto.title === undefined ? {} : { title: dto.title }),
      ...(dto.body === undefined ? {} : { body: dto.body }),
      ...(dto.status === undefined ? {} : { status: dto.status }),
    };
    const updated = await this.notesRepository.updateByIdForOwner(
      objectId,
      ownerId,
      patch,
    );

    if (updated === null) {
      throw new NotFoundError(`Note not found: ${id}`);
    }

    await this.cache.del(noteCacheKeys.byOwnerAndId(ownerId, id));
    return toPublicNote(updated);
  }

  /**
   * Deletes a note, scoped to its owner, and invalidates its cached detail
   * entry.
   *
   * @param ownerId - The id of the note's owner.
   * @param id - The note's id.
   * @returns A promise that resolves once the note is removed.
   * @throws {NotFoundError} When no note with that id exists for that owner.
   */
  public async remove(ownerId: string, id: string): Promise<void> {
    const objectId = parseObjectId(id);
    const isDeleted = await this.notesRepository.deleteByIdForOwner(
      objectId,
      ownerId,
    );

    if (!isDeleted) {
      throw new NotFoundError(`Note not found: ${id}`);
    }

    await this.cache.del(noteCacheKeys.byOwnerAndId(ownerId, id));
  }
}
