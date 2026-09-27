import RedisMock from "ioredis-mock";
import { Types } from "mongoose";

import { CacheService } from "@/common/cache/cache.service";
import { NotFoundError, ValidationError } from "@/common/errors/app.error";

import { NoteStatus } from "@/modules/notes/notes.constants";
import { NotesRepository } from "@/modules/notes/notes.repository";
import { NotesService } from "@/modules/notes/notes.service";

const OWNER_ID = "owner-1";

/**
 * `ioredis-mock` shares one in-memory store across every instance in this
 * process, so each test uses its own id to avoid cross-test cache hits.
 *
 * @returns A fresh note id, distinct from every other test's.
 */
function freshNoteId(): string {
  return new Types.ObjectId().toHexString();
}

function buildRecord(id: string): {
  _id: Types.ObjectId;
  title: string;
  body: string;
  status: string;
  ownerId: string;
} {
  return {
    _id: new Types.ObjectId(id),
    title: "Title",
    body: "Body",
    status: NoteStatus.DRAFT,
    ownerId: OWNER_ID,
  };
}

function publicShapeOf(id: string): {
  _id: string;
  title: string;
  body: string;
  status: string;
  ownerId: string;
} {
  return { ...buildRecord(id), _id: id };
}

describe("NotesService", () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService(new RedisMock());
  });

  function buildService(repository: Partial<NotesRepository>): NotesService {
    return new NotesService(repository as NotesRepository, cache);
  }

  it("creates a note, returning it with a string _id", async () => {
    const noteId = freshNoteId();
    const create = jest.fn().mockResolvedValue(buildRecord(noteId));
    const service = buildService({ create });

    const result = await service.create(OWNER_ID, {
      title: "Title",
      body: "Body",
      status: NoteStatus.DRAFT,
    });

    expect(result).toEqual(publicShapeOf(noteId));
    expect(create).toHaveBeenCalledWith({
      title: "Title",
      body: "Body",
      status: NoteStatus.DRAFT,
      ownerId: OWNER_ID,
    });
  });

  it("finds a note by id scoped to the owner, and caches it", async () => {
    const noteId = freshNoteId();
    const findByIdForOwner = jest.fn().mockResolvedValue(buildRecord(noteId));
    const service = buildService({ findByIdForOwner });

    await expect(service.findById(OWNER_ID, noteId)).resolves.toEqual(
      publicShapeOf(noteId),
    );
    await expect(service.findById(OWNER_ID, noteId)).resolves.toEqual(
      publicShapeOf(noteId),
    );
    expect(findByIdForOwner).toHaveBeenCalledTimes(1);
    expect(findByIdForOwner).toHaveBeenCalledWith(
      new Types.ObjectId(noteId),
      OWNER_ID,
    );
  });

  it("throws ValidationError for a malformed id", async () => {
    const service = buildService({});

    await expect(service.findById(OWNER_ID, "not-an-id")).rejects.toThrow(
      ValidationError,
    );
  });

  it("throws NotFoundError when the note is missing for that owner", async () => {
    const findByIdForOwner = jest.fn().mockResolvedValue(null);
    const service = buildService({ findByIdForOwner });

    await expect(service.findById(OWNER_ID, freshNoteId())).rejects.toThrow(
      NotFoundError,
    );
  });

  it("never caches a not-found result (negative caching)", async () => {
    const noteId = freshNoteId();
    const findByIdForOwner = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildRecord(noteId));
    const service = buildService({ findByIdForOwner });

    await expect(service.findById(OWNER_ID, noteId)).rejects.toThrow(
      NotFoundError,
    );
    await expect(service.findById(OWNER_ID, noteId)).resolves.toEqual(
      publicShapeOf(noteId),
    );
    expect(findByIdForOwner).toHaveBeenCalledTimes(2);
  });

  it("lists notes with pagination, mapped to the public shape", async () => {
    const noteId = freshNoteId();
    const listByOwner = jest
      .fn()
      .mockResolvedValue({ items: [buildRecord(noteId)], total: 1 });
    const service = buildService({ listByOwner });

    await expect(
      service.list(OWNER_ID, { page: 1, limit: 20, sortDirection: "desc" }),
    ).resolves.toEqual({
      items: [publicShapeOf(noteId)],
      page: 1,
      limit: 20,
      total: 1,
    });
    expect(listByOwner).toHaveBeenCalledWith(
      OWNER_ID,
      {},
      { skip: 0, limit: 20, sortDirection: "desc" },
    );
  });

  it("updates a note scoped to the owner and invalidates the cache", async () => {
    const noteId = freshNoteId();
    const updateByIdForOwner = jest.fn().mockResolvedValue(buildRecord(noteId));
    const service = buildService({ updateByIdForOwner });

    await expect(
      service.update(OWNER_ID, noteId, { title: "New" }),
    ).resolves.toEqual(publicShapeOf(noteId));
    expect(updateByIdForOwner).toHaveBeenCalledWith(
      new Types.ObjectId(noteId),
      OWNER_ID,
      { title: "New" },
    );
  });

  it("throws NotFoundError updating a note missing for that owner", async () => {
    const updateByIdForOwner = jest.fn().mockResolvedValue(null);
    const service = buildService({ updateByIdForOwner });

    await expect(service.update(OWNER_ID, freshNoteId(), {})).rejects.toThrow(
      NotFoundError,
    );
  });

  it("removes a note scoped to the owner and invalidates the cache", async () => {
    const deleteByIdForOwner = jest.fn().mockResolvedValue(true);
    const service = buildService({ deleteByIdForOwner });

    await expect(
      service.remove(OWNER_ID, freshNoteId()),
    ).resolves.toBeUndefined();
  });

  it("throws NotFoundError removing a note missing for that owner", async () => {
    const deleteByIdForOwner = jest.fn().mockResolvedValue(false);
    const service = buildService({ deleteByIdForOwner });

    await expect(service.remove(OWNER_ID, freshNoteId())).rejects.toThrow(
      NotFoundError,
    );
  });
});
