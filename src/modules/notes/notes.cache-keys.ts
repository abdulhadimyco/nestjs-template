import { createCacheKeyBuilder } from "@/common/cache/cache-key.util";

/**
 * Cache keys used by the notes module. `byOwnerAndId` is scoped by owner as
 * well as note id: an owner-blind `notes:id:<id>` key would let one user's
 * cached read serve another user's request for the same id after an
 * ownership check elsewhere changes, or simply via a cache key collision
 * across owners once ids are guessable.
 */
export const noteCacheKeys = {
  byOwnerAndId: createCacheKeyBuilder<[string, string]>("notes:owner"),
};
