import type { FastifyRequest } from "fastify";
import type { Redis } from "ioredis";

import { ErrorCode } from "@/common/errors/error-codes.constants";
import { buildRateLimitOptions } from "@/common/security/rate-limit-options.factory";

describe("buildRateLimitOptions", () => {
  const input = { max: 10, windowMs: 1000 };

  it("carries max and timeWindow through from the input", () => {
    const options = buildRateLimitOptions(input);

    expect(options.max).toBe(10);
    expect(options.timeWindow).toBe(1000);
  });

  it("keys the limit by request.ip when no clientIpHeader is set", () => {
    const options = buildRateLimitOptions(input);
    // Test double: only `ip` is needed by keyGenerator, casting past the rest
    // of FastifyRequest's large interface.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const request = { ip: "203.0.113.5", headers: {} } as FastifyRequest;

    expect(options.keyGenerator?.(request)).toBe("203.0.113.5");
  });

  it("keys the limit by the configured header when clientIpHeader is set", () => {
    const options = buildRateLimitOptions({
      ...input,
      clientIpHeader: "cf-connecting-ip",
    });
    const request = {
      ip: "10.0.0.1",
      headers: { "cf-connecting-ip": "198.51.100.7" },
    } as unknown as FastifyRequest;

    expect(options.keyGenerator?.(request)).toBe("198.51.100.7");
  });

  it("falls back to request.ip when the configured header is absent", () => {
    const options = buildRateLimitOptions({
      ...input,
      clientIpHeader: "cf-connecting-ip",
    });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const request = { ip: "10.0.0.1", headers: {} } as FastifyRequest;

    expect(options.keyGenerator?.(request)).toBe("10.0.0.1");
  });

  it("omits the redis option when none is provided", () => {
    const options = buildRateLimitOptions(input);

    expect(options.redis).toBeUndefined();
  });

  it("forwards a provided ioredis client as the redis option", () => {
    // Test double: only identity matters — buildRateLimitOptions must forward
    // it unchanged, never construct or configure a client itself.
    const redisClient = { id: "fake-redis-client" } as unknown as Redis;

    const options = buildRateLimitOptions(input, redisClient);

    expect(options.redis).toBe(redisClient);
  });

  it("shows the standard rate-limit headers on every response", () => {
    const options = buildRateLimitOptions(input);

    expect(options.addHeaders).toEqual({
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    });
    expect(options.addHeadersOnExceeding).toEqual({
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    });
  });

  it("builds our error contract body on 429", () => {
    const options = buildRateLimitOptions(input);
    // Test double: only `id` is needed by errorResponseBuilder, casting past
    // the rest of FastifyRequest's large interface.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const request = { id: "req-1" } as FastifyRequest;

    const body = options.errorResponseBuilder?.(request, {
      statusCode: 429,
      ban: false,
      after: "1 second",
      max: 10,
      ttl: 1000,
    }) as {
      code: string;
      message: string;
      details: { retryAfterMs: number };
      requestId: string;
    };

    expect(body).toEqual({
      code: ErrorCode.RATE_LIMITED,
      message: "Rate limit exceeded, retry in 1 second",
      details: { retryAfterMs: 1000 },
      requestId: "req-1",
    });
  });
});
