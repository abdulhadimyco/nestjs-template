import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppConfigService } from "@/config/app-config.service";
import { parseEnv } from "@/config/env.schema";
import { AppLogger } from "@/common/logger/app-logger.service";

import { AppModule } from "@/app.module";
import { configureApp, createFastifyAdapter } from "@/app.setup";

/**
 * Boots the Fastify-backed Nest application and starts listening.
 *
 * @returns A promise that resolves once the server is listening.
 */
async function bootstrap(): Promise<void> {
  // The adapter needs `trustProxy` BEFORE the Nest container exists, so the
  // environment is parsed once here; AppConfigService re-parses it for DI.
  // eslint-disable-next-line no-restricted-properties
  const { TRUST_PROXY: trustProxy } = parseEnv(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createFastifyAdapter(trustProxy),
    { rawBody: true, bufferLogs: true },
  );
  const docsPath = await configureApp(app);

  const config = app.get(AppConfigService);
  await app.listen(config.port, "0.0.0.0");

  app.get(AppLogger).info("app_started", {
    nodeEnv: config.nodeEnv,
    port: config.port,
    url: `http://localhost:${config.port}/api`,
    docsUrl:
      docsPath === null ? null : `http://localhost:${config.port}/${docsPath}`,
    trustProxy: config.trustProxy,
    rateLimit: config.rateLimit,
    allowedOrigins: config.allowedOrigins.length,
    logLevel: config.logLevel,
    logFormat: config.logFormat,
  });
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    "Failed to bootstrap application",
    error instanceof Error ? error.stack : error,
  );
  process.exit(1);
});
