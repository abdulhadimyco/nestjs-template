import type { Model } from "mongoose";
import { Types } from "mongoose";

import { NotesRepository } from "@/modules/notes/notes.repository";
import type { Note } from "@/modules/notes/schemas/note.schema";

const OWNER_ID = "owner-1";
const OTHER_OWNER_ID = "owner-2";
const ID = new Types.ObjectId();

function chainable<T>(resolvedValue: T): {
  lean: () => typeof chain;
  sort: () => typeof chain;
  skip: () => typeof chain;
  limit: () => typeof chain;
  exec: () => Promise<T>;
} {
  const chain = {
    lean: () => chain,
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    exec: () => Promise.resolve(resolvedValue),
  };

  return chain;
}

function buildRepository(model: Partial<Model<Note>>): NotesRepository {
  return new NotesRepository(model as Model<Note>);
}

describe("NotesRepository", () => {
  it("create() creates then re-reads with the detail projection", async () => {
    const create = jest.fn().mockResolvedValue({ _id: ID });
    const findOne = jest.fn().mockReturnValue(chainable({ title: "Title" }));
    const repository = buildRepository({ create, findOne });

    await repository.create({
      title: "Title",
      body: "Body",
      status: "draft",
      ownerId: OWNER_ID,
    });

    expect(create).toHaveBeenCalledWith({
      title: "Title",
      body: "Body",
      status: "draft",
      ownerId: OWNER_ID,
    });
    expect(findOne).toHaveBeenCalledWith(
      { _id: ID },
      { title: 1, body: 1, status: 1, ownerId: 1 },
    );
  });

  it("findByIdForOwner() queries by _id AND ownerId with the detail projection", async () => {
    const findOne = jest.fn().mockReturnValue(chainable({ title: "Title" }));
    const repository = buildRepository({ findOne });

    await repository.findByIdForOwner(ID, OWNER_ID);

    expect(findOne).toHaveBeenCalledWith(
      { _id: ID, ownerId: OWNER_ID },
      { title: 1, body: 1, status: 1, ownerId: 1 },
    );
  });

  it("findByIdForOwner() returns null for another owner's note (no cross-owner read)", async () => {
    // The mocked model always "matches" its filter argument here; the real
    // assertion is that the filter includes the CALLING owner, not some
    // other owner — see the expectation above. This test documents intent:
    // a real Mongo query with { _id, ownerId } simply won't match another
    // owner's document, so the repository returns null for it.
    const findOne = jest.fn().mockReturnValue(chainable(null));
    const repository = buildRepository({ findOne });

    await expect(
      repository.findByIdForOwner(ID, OTHER_OWNER_ID),
    ).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledWith(
      { _id: ID, ownerId: OTHER_OWNER_ID },
      { title: 1, body: 1, status: 1, ownerId: 1 },
    );
  });

  it("listByOwner() filters by owner only when no status is given", async () => {
    const find = jest.fn().mockReturnValue(chainable([]));
    const countDocuments = jest
      .fn()
      .mockReturnValue({ exec: () => Promise.resolve(0) });
    const repository = buildRepository({ find, countDocuments });

    const result = await repository.listByOwner(
      OWNER_ID,
      {},
      { skip: 0, limit: 20, sortDirection: "desc" },
    );

    expect(find).toHaveBeenCalledWith(
      { ownerId: OWNER_ID },
      { title: 1, status: 1, ownerId: 1 },
    );
    expect(countDocuments).toHaveBeenCalledWith({ ownerId: OWNER_ID });
    expect(result).toEqual({ items: [], total: 0 });
  });

  it("listByOwner() adds the status filter when given", async () => {
    const find = jest.fn().mockReturnValue(chainable([]));
    const countDocuments = jest
      .fn()
      .mockReturnValue({ exec: () => Promise.resolve(0) });
    const repository = buildRepository({ find, countDocuments });

    await repository.listByOwner(
      OWNER_ID,
      { status: "draft" },
      { skip: 0, limit: 20, sortDirection: "asc" },
    );

    expect(find).toHaveBeenCalledWith(
      { ownerId: OWNER_ID, status: "draft" },
      { title: 1, status: 1, ownerId: 1 },
    );
  });

  it("updateByIdForOwner() updates by _id AND ownerId with { new: true, projection }", async () => {
    const findOneAndUpdate = jest
      .fn()
      .mockReturnValue(chainable({ title: "Updated" }));
    const repository = buildRepository({ findOneAndUpdate });

    await repository.updateByIdForOwner(ID, OWNER_ID, { title: "Updated" });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ID, ownerId: OWNER_ID },
      { title: "Updated" },
      { new: true, projection: { title: 1, body: 1, status: 1, ownerId: 1 } },
    );
  });

  it("deleteByIdForOwner() deletes by _id AND ownerId", async () => {
    const deleteOne = jest
      .fn()
      .mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 1 }) });
    const repository = buildRepository({ deleteOne });

    await expect(repository.deleteByIdForOwner(ID, OWNER_ID)).resolves.toBe(
      true,
    );
    expect(deleteOne).toHaveBeenCalledWith({ _id: ID, ownerId: OWNER_ID });
  });
});
