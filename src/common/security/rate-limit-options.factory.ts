import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";
import type { Redis } from "ioredis";

import { ErrorCode } from "@/common/errors/error-codes.constants";
import type { ErrorResponseBody } from "@/common/errors/error-response.types";

/** Input to {@link buildRateLimitOptions}. */
export type RateLimitOptionsInput = {
  max: number;
  windowMs: number;
  /**
   * When set, the rate-limit key is read from this request header instead of
   * `request.ip` — for example `cf-connecting-ip` on a service that is only
   * ever reached through Cloudflare, which sets that header itself and
   * cannot be spoofed by the client. Leave unset to key by `request.ip`
   * (see `TRUST_PROXY` in `env.schema.ts` for how that value is resolved).
   */
  clientIpHeader?: string;
};

/**
 * Builds the `@fastify/rate-limit` plugin options for this service: a fixed
 * request cap per client, our error contract on 429, and the standard
 * `x-ratelimit-*` / `retry-after` headers on every response.
 *
 * @param input - The configured request cap, time window, and optional
 * client-ip header override.
 * @param redis - An optional `ioredis` client. When provided, the limit is
 * enforced cluster-wide (shared count across every replica) instead of
 * per-replica in-memory.
 * @returns The Fastify rate-limit plugin options.
 */
export function buildRateLimitOptions(
  input: RateLimitOptionsInput,
  redis?: Redis,
): RateLimitPluginOptions {
  return {
    max: input.max,
    timeWindow: input.windowMs,
    keyGenerator: request => resolveKey(request, input.clientIpHeader),
    ...(redis !== undefined ? { redis } : {}),
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
    addHeadersOnExceeding: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
    errorResponseBuilder: (request, context): ErrorResponseBody => ({
      code: ErrorCode.RATE_LIMITED,
      message: `Rate limit exceeded, retry in ${context.after}`,
      details: { retryAfterMs: context.ttl },
      requestId: request.id,
    }),
  };
}

/**
 * Resolves the rate-limit key for a request: the configured header when set
 * and present, otherwise `request.ip`.
 *
 * @param request - The incoming Fastify request.
 * @param clientIpHeader - The header to read the client ip from, if any.
 * @returns The resolved rate-limit key.
 */
function resolveKey(request: FastifyRequest, clientIpHeader?: string): string {
  if (clientIpHeader === undefined) {
    return request.ip;
  }

  const headerValue = request.headers[clientIpHeader.toLowerCase()];
  return typeof headerValue === "string" ? headerValue : request.ip;
}
