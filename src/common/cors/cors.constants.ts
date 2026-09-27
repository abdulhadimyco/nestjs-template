/** Wildcard origin value that allows any origin. */
export const CORS_WILDCARD_ORIGIN = "*";

/** Request headers this service accepts on cross-origin requests. */
export const CORS_ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "Cache-Control",
  "x-request-id",
] as const;

/**
 * HTTP methods this service accepts on cross-origin requests. Listed
 * explicitly because `@fastify/cors`'s own defaults omit `PUT` and
 * `DELETE`.
 */
export const CORS_ALLOWED_METHODS = [
  "GET",
  "HEAD",
  "PUT",
  "PATCH",
  "POST",
  "DELETE",
  "OPTIONS",
] as const;

/** Headers this service exposes to cross-origin callers. */
export const CORS_EXPOSED_HEADERS = [
  "x-request-id",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "retry-after",
] as const;

/** How long (in seconds) a preflight response may be cached by the client. */
export const CORS_MAX_AGE_SECONDS = 600;

/** The HTTP status returned for a successful `OPTIONS` preflight request. */
export const CORS_OPTIONS_SUCCESS_STATUS = 204;
