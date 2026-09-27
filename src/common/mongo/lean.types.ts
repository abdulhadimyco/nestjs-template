import type { Document, Types } from "mongoose";

/**
 * The shape returned by a `.lean()` Mongoose query for schema `T`: the
 * plain fields of `T` plus a real `ObjectId` `_id`, without any Mongoose
 * document methods.
 */
export type Lean<T> = Omit<T, keyof Document> & { _id: Types.ObjectId };

/** A Mongo projection object for schema `T`: include (`1`) or exclude (`0`) fields. */
export type Projection<T> = Partial<Record<keyof T, 1 | 0>>;
