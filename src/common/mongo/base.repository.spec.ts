import type { Model } from "mongoose";

import { BaseRepository } from "@/common/mongo/base.repository";

type Doc = { title: string };

class TestRepository extends BaseRepository<Doc> {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- widens BaseRepository's protected constructor to public so this test class can be instantiated directly.
  constructor(model: Model<Doc>) {
    super(model);
  }

  public async callFindOne(): Promise<Doc | null> {
    return this.findOne<Doc>({ title: "a" }, { title: 1 });
  }

  public async callFindMany(): Promise<Doc[]> {
    return this.findMany<Doc>(
      { title: "a" },
      { title: 1 },
      { skip: 0, limit: 10, sort: { title: 1 } },
    );
  }

  public async callCount(): Promise<number> {
    return this.count({ title: "a" });
  }

  public async callCreateOne(): Promise<Doc> {
    return this.createOne<Doc>({ title: "a" }, { title: 1 });
  }

  public async callUpdateOne(): Promise<Doc | null> {
    return this.updateOne<Doc>({ title: "a" }, { title: "b" }, { title: 1 });
  }

  public async callDeleteOne(): Promise<boolean> {
    return this.deleteOne({ title: "a" });
  }
}

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

describe("BaseRepository", () => {
  it("findOne applies the projection and lean()", async () => {
    const findOne = jest.fn().mockReturnValue(chainable({ title: "a" }));
    const model: Partial<Model<Doc>> = { findOne };
    const repo = new TestRepository(model as Model<Doc>);

    await expect(repo.callFindOne()).resolves.toEqual({ title: "a" });
    expect(findOne).toHaveBeenCalledWith({ title: "a" }, { title: 1 });
  });

  it("findMany applies the projection, sort/skip/limit, and lean()", async () => {
    const find = jest.fn().mockReturnValue(chainable([{ title: "a" }]));
    const model: Partial<Model<Doc>> = { find };
    const repo = new TestRepository(model as Model<Doc>);

    await expect(repo.callFindMany()).resolves.toEqual([{ title: "a" }]);
    expect(find).toHaveBeenCalledWith({ title: "a" }, { title: 1 });
  });

  it("count delegates to countDocuments", async () => {
    const countDocuments = jest
      .fn()
      .mockReturnValue({ exec: () => Promise.resolve(3) });
    const model: Partial<Model<Doc>> = { countDocuments };
    const repo = new TestRepository(model as Model<Doc>);

    await expect(repo.callCount()).resolves.toBe(3);
  });

  it("createOne creates then re-reads with the projection, lean", async () => {
    const create = jest.fn().mockResolvedValue({ _id: "id-1" });
    const findOne = jest.fn().mockReturnValue(chainable({ title: "a" }));
    const model: Partial<Model<Doc>> = { create, findOne };
    const repo = new TestRepository(model as Model<Doc>);

    await expect(repo.callCreateOne()).resolves.toEqual({ title: "a" });
    expect(findOne).toHaveBeenCalledWith({ _id: "id-1" }, { title: 1 });
  });

  it("createOne throws if the reload comes back empty", async () => {
    const create = jest.fn().mockResolvedValue({ _id: "id-1" });
    const findOne = jest.fn().mockReturnValue(chainable(null));
    const model: Partial<Model<Doc>> = { create, findOne };
    const repo = new TestRepository(model as Model<Doc>);

    await expect(repo.callCreateOne()).rejects.toThrow();
  });

  it("updateOne applies { new: true, projection } and lean", async () => {
    const findOneAndUpdate = jest
      .fn()
      .mockReturnValue(chainable({ title: "b" }));
    const model: Partial<Model<Doc>> = { findOneAndUpdate };
    const repo = new TestRepository(model as Model<Doc>);

    await expect(repo.callUpdateOne()).resolves.toEqual({ title: "b" });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { title: "a" },
      { title: "b" },
      { new: true, projection: { title: 1 } },
    );
  });

  it("deleteOne returns true when a document was deleted", async () => {
    const deleteOne = jest
      .fn()
      .mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 1 }) });
    const model: Partial<Model<Doc>> = { deleteOne };
    const repo = new TestRepository(model as Model<Doc>);

    await expect(repo.callDeleteOne()).resolves.toBe(true);
  });

  it("deleteOne returns false when nothing matched", async () => {
    const deleteOne = jest
      .fn()
      .mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 0 }) });
    const model: Partial<Model<Doc>> = { deleteOne };
    const repo = new TestRepository(model as Model<Doc>);

    await expect(repo.callDeleteOne()).resolves.toBe(false);
  });
});
