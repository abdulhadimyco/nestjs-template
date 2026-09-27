const PART_PATTERN = /^\S+$/;

/**
 * Validates a single cache key part.
 *
 * @param prefix - The key prefix this part belongs to, used for error context.
 * @param part - The candidate key part.
 * @throws {TypeError} When the part is empty, contains a colon, or contains whitespace.
 */
function assertValidPart(prefix: string, part: string): void {
  if (part.length === 0 || part.includes(":") || !PART_PATTERN.test(part)) {
    throw new TypeError(
      `Invalid cache key part "${part}" for prefix "${prefix}": parts must be non-empty and contain no ":" or whitespace`,
    );
  }
}

/**
 * Builds a typed cache key builder for a given prefix. This is the single
 * pattern every module should use to construct cache keys: declare one
 * builder per key shape in a `<feature>.cache-keys.ts` file instead of
 * spelling key strings inline.
 *
 * @param prefix - The static prefix shared by every key this builder produces.
 * @returns A function that joins the prefix and given parts with `:`.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TParts is fixed per call site so each builder gets its own typed tuple.
export function createCacheKeyBuilder<TParts extends readonly string[]>(
  prefix: string,
): (...parts: TParts) => string {
  return (...parts: TParts): string => {
    for (const part of parts) {
      assertValidPart(prefix, part);
    }

    return [prefix, ...parts].join(":");
  };
}
