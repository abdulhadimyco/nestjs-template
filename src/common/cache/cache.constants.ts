/** Standard cache TTLs, in seconds, shared across modules. */
export const CACHE_TTL_SECONDS = {
  SHORT: 60,
  DEFAULT: 3600,
  LONG: 86_400,
} as const;

/** Injection token for the shared `ioredis` client instance. */
export const REDIS_CLIENT = "REDIS_CLIENT";
