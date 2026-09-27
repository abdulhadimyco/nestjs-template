import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { VersioningType } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { Redis } from "ioredis";

import { AppConfigService } from "@/config/app-config.service";
import { REDIS_CLIENT } from "@/common/cache/cache.constants";
import { buildCorsOptions } from "@/common/cors/cors-options.factory";
import { AppLogger } from "@/common/logger/app-logger.service";
import { OPENAPI_DEFAULTS } from "@/common/openapi/openapi.constants";
import { setupOpenApi } from "@/common/openapi/openapi.setup";
import { buildHelmetOptions } from "@/common/security/helmet-options";
import { buildRateLimitOptions } from "@/common/security/rate-limit-options.factory";
import { createRequestIdHook } from "@/common/security/request-id.hook";

/** Upper bound for request bodies; raise per-route if a real need appears. */
const BODY_LIMIT_BYTES = 10 * 1024 * 1024;
/** Incoming header whose value becomes `request.id`; echoed back by the hook. */
const REQUEST_ID_HEADER = "x-request-id";
/** Global route prefix; versioned controllers mount under `/api/v<version>`. */
const GLOBAL_PREFIX = "api";

/**
 * Builds the Fastify adapter with the settings that must exist before the
 * Nest container does (`trustProxy` cannot be changed after construction).
 *
 * @param trustProxy - Fastify's `trustProxy` value from the environment.
 * @returns A configured adapter for `NestFactory.create`.
 */
export function createFastifyAdapter(
  trustProxy: boolean | number | string[],
): FastifyAdapter {
  return new FastifyAdapter({
    bodyLimit: BODY_LIMIT_BYTES,
    trustProxy,
    requestIdHeader: REQUEST_ID_HEADER,
  });
}

/** Options for {@link configureApp}. */
export type ConfigureAppOptions = {
  /**
   * Mount the Swagger UI (never in production regardless). Tests pass `false`:
   * `@fastify/static` pulls in the ESM-only `content-disposition@3`, which
   * Node 22 can `require()` but Jest's CommonJS runtime cannot.
   */
  serveDocs?: boolean;
};

/**
 * Applies every piece of app-level wiring that is not a Nest module: logger,
 * shutdown hooks, security plugins, prefix/versioning and the OpenAPI UI.
 * Called by `main.ts` and by the e2e bootstrap, so tests run the same edge
 * configuration production does.
 *
 * @param app - The Nest application, created but not yet initialised.
 * @param options - See {@link ConfigureAppOptions}.
 * @returns The path the OpenAPI UI is served at, or `null` when not mounted.
 */
export async function configureApp(
  app: NestFastifyApplication,
  options: ConfigureAppOptions = {},
): Promise<string | null> {
  app.useLogger(app.get(AppLogger));
  app.enableShutdownHooks();

  const config = app.get(AppConfigService);
  await registerSecurity(app, config);

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI });

  if (config.isProduction || options.serveDocs === false) {
    return null;
  }
  setupOpenApi(app, {
    title: "nestjs-template",
    version: "1",
    serveAt: OPENAPI_DEFAULTS.SERVE_AT,
  });
  return OPENAPI_DEFAULTS.SERVE_AT;
}

/**
 * Registers the edge-facing security plugins in one place: headers, CORS
 * allowlist, per-IP rate limit (cluster-wide when Redis is available) and
 * the request-id echo.
 *
 * @param app - The Nest application.
 * @param config - The typed application config.
 * @returns A promise that resolves once all plugins are registered.
 */
async function registerSecurity(
  app: NestFastifyApplication,
  config: AppConfigService,
): Promise<void> {
  await app.register(
    helmet,
    buildHelmetOptions({ isProduction: config.isProduction }),
  );
  await app.register(
    cors,
    buildCorsOptions({
      allowedOrigins: config.allowedOrigins,
      isProduction: config.isProduction,
    }),
  );
  // Switchable: services behind an edge limiter (Cloudflare) set
  // RATE_LIMIT_ENABLED=false instead of limiting twice.
  if (config.rateLimit.enabled) {
    const redis = app.get<Redis>(REDIS_CLIENT);
    await app.register(
      rateLimit,
      buildRateLimitOptions(config.rateLimit, redis),
    );
  }
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onRequest", createRequestIdHook());
}
