import type { INestApplication } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

import { OPENAPI_DEFAULTS } from "@/common/openapi/openapi.constants";

/** Options accepted by {@link setupOpenApi}. */
export type OpenApiSetupOptions = {
  /** The document title, usually the service name. */
  title: string;
  /** The document version, usually the service's package version. */
  version: string;
  /** The path the Swagger UI is served at. Defaults to `docs`. */
  serveAt?: string;
};

/**
 * Builds the OpenAPI document for a Nest application and cleans it up for
 * Zod-generated schemas. Safe to call after the app has booted, because it
 * registers no routes — used by `scripts/generate-openapi.ts` in CI.
 *
 * @param app - The Nest application instance.
 * @param options - The document title and version.
 * @returns The generated, cleaned-up OpenAPI document.
 */
export function buildOpenApiDocument(
  app: INestApplication,
  options: Pick<OpenApiSetupOptions, "title" | "version">,
): OpenAPIObject {
  const documentConfig = new DocumentBuilder()
    .setTitle(options.title)
    .setVersion(options.version)
    .addBearerAuth(
      { type: "http", scheme: "bearer" },
      OPENAPI_DEFAULTS.BEARER_SCHEME_NAME,
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  return cleanupOpenApiDoc(document);
}

/**
 * Builds the OpenAPI document and serves the Swagger UI. Must run before
 * `app.listen()`/`app.init()` because serving the UI registers routes.
 *
 * @param app - The Nest application instance.
 * @param options - The document title, version and optional UI path.
 * @returns The generated, cleaned-up OpenAPI document.
 */
export function setupOpenApi(
  app: INestApplication,
  options: OpenApiSetupOptions,
): OpenAPIObject {
  const cleanedDocument = buildOpenApiDocument(app, options);
  SwaggerModule.setup(
    options.serveAt ?? OPENAPI_DEFAULTS.SERVE_AT,
    app,
    cleanedDocument,
  );
  return cleanedDocument;
}
