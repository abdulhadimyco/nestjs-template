import type { FilterQuery, Model, UpdateQuery } from "mongoose";

import type { Projection } from "@/common/mongo/lean.types";

/** Pagination params accepted by {@link BaseRepository.findMany}. */
export type PageParams = {
  skip: number;
  limit: number;
  sort: Record<string, 1 | -1>;
};

/**
 * Generic, DB-shaped data-access primitives shared by every collection's
 * repository. All primitives are `protected`: only a concrete repository
 * (e.g. `NotesRepository`) may call them, and it does so from
 * intent-named public methods that build the Mongo query internally.
 * Nothing above the repository layer ever sees a `FilterQuery` or
 * `UpdateQuery` — that boundary is what keeps a future datastore swap
 * confined to this layer. Every read is `.lean()` with an explicit
 * projection; there is no primitive without one.
 */
export abstract class BaseRepository<TDoc> {
  /**
   * Creates the repository.
   *
   * @param model - The Mongoose model this repository wraps.
   */
  protected constructor(private readonly model: Model<TDoc>) {}

  /**
   * Finds a single lean, projected document.
   *
   * @param filter - The Mongo filter to match.
   * @param projection - The fields to include.
   * @returns The matching document, or `null` when none matches.
   */
  protected async findOne<TProj>(
    filter: FilterQuery<TDoc>,
    projection: Projection<TDoc>,
  ): Promise<TProj | null> {
    return this.model.findOne(filter, projection).lean<TProj>().exec();
  }

  /**
   * Finds a page of lean, projected documents. Pair with {@link count} (run
   * together in a `Promise.all`) to get a total alongside the page — this
   * primitive does not compute one itself, so a caller that only needs the
   * page doesn't pay for an unnecessary `countDocuments`.
   *
   * @param filter - The Mongo filter to match.
   * @param projection - The fields to include.
   * @param page - Skip/limit/sort for the page.
   * @returns The page of items.
   */
  protected async findMany<TProj>(
    filter: FilterQuery<TDoc>,
    projection: Projection<TDoc>,
    page: PageParams,
  ): Promise<TProj[]> {
    return this.model
      .find(filter, projection)
      .sort(page.sort)
      .skip(page.skip)
      .limit(page.limit)
      .lean<TProj[]>()
      .exec();
  }

  /**
   * Counts documents matching a filter.
   *
   * @param filter - The Mongo filter to match.
   * @returns The number of matching documents.
   */
  protected async count(filter: FilterQuery<TDoc>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  /**
   * Creates a document and returns it lean and projected.
   *
   * @param input - The fields to create the document with.
   * @param projection - The fields to include in the returned document.
   * @returns The created document, lean and projected.
   */
  protected async createOne<TProj>(
    input: Partial<TDoc>,
    projection: Projection<TDoc>,
  ): Promise<TProj> {
    // Created then re-read with the projection, rather than trusting the
    // hydrated document's shape: this keeps `createOne`'s return type as
    // strictly projected-and-lean as every other primitive here.
    const created = await this.model.create(input);
    const filter: FilterQuery<TDoc> = { _id: created._id };
    const reloaded = await this.findOne<TProj>(filter, projection);

    if (reloaded === null) {
      throw new Error(
        "Failed to reload document immediately after creating it",
      );
    }

    return reloaded;
  }

  /**
   * Updates a single document and returns the updated, lean, projected
   * result.
   *
   * @param filter - The Mongo filter selecting the document to update.
   * @param update - The update to apply.
   * @param projection - The fields to include in the returned document.
   * @returns The updated document, or `null` when no document matched.
   */
  protected async updateOne<TProj>(
    filter: FilterQuery<TDoc>,
    update: UpdateQuery<TDoc>,
    projection: Projection<TDoc>,
  ): Promise<TProj | null> {
    return this.model
      .findOneAndUpdate(filter, update, { new: true, projection })
      .lean<TProj>()
      .exec();
  }

  /**
   * Deletes a single document matching a filter.
   *
   * @param filter - The Mongo filter selecting the document to delete.
   * @returns True when a document was deleted.
   */
  protected async deleteOne(filter: FilterQuery<TDoc>): Promise<boolean> {
    const result = await this.model.deleteOne(filter).exec();
    return result.deletedCount > 0;
  }
}
