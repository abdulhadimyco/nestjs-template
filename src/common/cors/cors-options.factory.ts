import type { FastifyCorsOptions } from "@fastify/cors";

import {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_EXPOSED_HEADERS,
  CORS_MAX_AGE_SECONDS,
  CORS_OPTIONS_SUCCESS_STATUS,
  CORS_WILDCARD_ORIGIN,
} from "@/common/cors/cors.constants";

/** Input to {@link buildCorsOptions}. */
export type CorsOptionsInput = {
  allowedOrigins: readonly string[];
  isProduction: boolean;
};

/**
 * Builds the `@fastify/cors` plugin options for this service, mirroring the
 * Myco platform's allowlist/wildcard/credentials semantics.
 *
 * @param input - The configured allowlist and environment.
 * @returns The Fastify CORS plugin options.
 */
export function buildCorsOptions(input: CorsOptionsInput): FastifyCorsOptions {
  const { allowedOrigins, isProduction } = input;
  const hasWildcard = allowedOrigins.includes(CORS_WILDCARD_ORIGIN);

  return {
    origin: (origin, callback) => {
      callback(null, resolveOrigin(origin, allowedOrigins, hasWildcard));
    },
    credentials: isProduction && !hasWildcard,
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    methods: [...CORS_ALLOWED_METHODS],
    exposedHeaders: [...CORS_EXPOSED_HEADERS],
    maxAge: CORS_MAX_AGE_SECONDS,
    preflightContinue: false,
    optionsSuccessStatus: CORS_OPTIONS_SUCCESS_STATUS,
  };
}

/**
 * Decides whether a request's origin should be allowed.
 *
 * @param origin - The `Origin` header value, if any.
 * @param allowedOrigins - The configured allowlist.
 * @param hasWildcard - Whether the allowlist contains the wildcard entry.
 * @returns `true`/the reflected origin string when allowed, else `false`.
 */
function resolveOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
  hasWildcard: boolean,
): boolean | string {
  return (
    hasWildcard ||
    (origin !== undefined && allowedOrigins.includes(origin) && origin)
  );
}
