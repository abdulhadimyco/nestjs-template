import { Types } from "mongoose";

import { ValidationError } from "@/common/errors/app.error";

/**
 * Parses a string into a Mongo `ObjectId`.
 *
 * @param value - The candidate id string.
 * @returns The parsed `ObjectId`.
 * @throws {ValidationError} When `value` is not a valid `ObjectId`.
 */
export function parseObjectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new ValidationError(`Invalid id: "${value}"`);
  }

  return new Types.ObjectId(value);
}
