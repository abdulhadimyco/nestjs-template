import type { ZodType } from "zod";

/** A pair of functions for turning a value into a string and back. */
export type Codec<T> = {
  parse: (raw: string) => T;
  serialize: (value: T) => string;
};

/**
 * Builds a JSON codec for {@link CacheService}. When a Zod schema is given,
 * parsed values are additionally validated against it.
 *
 * @param schema - An optional Zod schema to validate parsed values against.
 * @returns A codec that serializes with `JSON.stringify` and parses with
 * `JSON.parse`, optionally validated by `schema`.
 */
export function createJsonCodec<T>(schema?: ZodType<T>): Codec<T> {
  return {
    serialize: (value: T): string => JSON.stringify(value),
    parse: (raw: string): T => {
      const parsed: unknown = JSON.parse(raw);
      return schema ? schema.parse(parsed) : (parsed as T);
    },
  };
}
