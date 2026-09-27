import {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_EXPOSED_HEADERS,
  CORS_MAX_AGE_SECONDS,
  CORS_OPTIONS_SUCCESS_STATUS,
} from "@/common/cors/cors.constants";
import { buildCorsOptions } from "@/common/cors/cors-options.factory";

/**
 * Invokes a fastify-cors `origin` function and resolves with the callback's
 * arguments.
 *
 * @param options - The built CORS options under test.
 * @param origin - The `Origin` header value to evaluate.
 * @returns A tuple of the callback's `(error, allowed)` arguments.
 */
async function evaluateOrigin(
  options: ReturnType<typeof buildCorsOptions>,
  origin: string | undefined,
): Promise<[Error | null, unknown]> {
  const originFn = options.origin;

  if (typeof originFn !== "function") {
    throw new TypeError("Expected origin to be a function");
  }

  return new Promise(resolve => {
    const callback = (error: Error | null, allowed: unknown): void => {
      resolve([error, allowed]);
    };
    const typedOriginFn = originFn as (
      origin: string | undefined,
      callback: (error: Error | null, allowed: unknown) => void,
    ) => void;

    typedOriginFn(origin, callback);
  });
}

describe("buildCorsOptions", () => {
  it("reflects an origin present in the allowlist", async () => {
    const options = buildCorsOptions({
      allowedOrigins: ["https://a.test", "https://b.test"],
      isProduction: false,
    });

    const [error, allowed] = await evaluateOrigin(options, "https://a.test");

    expect(error).toBeNull();
    expect(allowed).toBe("https://a.test");
  });

  it("refuses an origin absent from the allowlist without throwing", async () => {
    const options = buildCorsOptions({
      allowedOrigins: ["https://a.test"],
      isProduction: false,
    });

    const [error, allowed] = await evaluateOrigin(options, "https://evil.test");

    expect(error).toBeNull();
    expect(allowed).toBe(false);
  });

  it("allows any origin when the allowlist contains the wildcard", async () => {
    const options = buildCorsOptions({
      allowedOrigins: ["*"],
      isProduction: false,
    });

    const [error, allowed] = await evaluateOrigin(
      options,
      "https://anything.test",
    );

    expect(error).toBeNull();
    expect(allowed).toBe(true);
  });

  it("enables credentials in production without a wildcard", () => {
    const options = buildCorsOptions({
      allowedOrigins: ["https://a.test"],
      isProduction: true,
    });

    expect(options.credentials).toBe(true);
  });

  it("disables credentials when a wildcard origin is configured", () => {
    const options = buildCorsOptions({
      allowedOrigins: ["*"],
      isProduction: true,
    });

    expect(options.credentials).toBe(false);
  });

  it("disables credentials outside production", () => {
    const options = buildCorsOptions({
      allowedOrigins: ["https://a.test"],
      isProduction: false,
    });

    expect(options.credentials).toBe(false);
  });

  it("configures headers, methods, exposed headers, and cache settings", () => {
    const options = buildCorsOptions({
      allowedOrigins: ["https://a.test"],
      isProduction: false,
    });

    expect(options.allowedHeaders).toEqual(CORS_ALLOWED_HEADERS);
    expect(options.methods).toEqual(CORS_ALLOWED_METHODS);
    expect(options.exposedHeaders).toEqual(CORS_EXPOSED_HEADERS);
    expect(options.maxAge).toBe(CORS_MAX_AGE_SECONDS);
    expect(options.preflightContinue).toBe(false);
    expect(options.optionsSuccessStatus).toBe(CORS_OPTIONS_SUCCESS_STATUS);
  });
});
