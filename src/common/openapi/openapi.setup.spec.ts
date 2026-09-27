import type { INestApplication } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import { SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

import { OPENAPI_DEFAULTS } from "@/common/openapi/openapi.constants";
import {
  buildOpenApiDocument,
  setupOpenApi,
} from "@/common/openapi/openapi.setup";

/**
 * Builds a fresh minimal document, since `cleanupOpenApiDoc` mutates its input and every test
 * must start from an unmodified stub.
 *
 * @returns A minimal valid OpenAPI document.
 */
function buildStubDocument(): OpenAPIObject {
  return { openapi: "3.0.0", info: { title: "t", version: "1" }, paths: {} };
}

jest.mock("@nestjs/swagger", () => {
  const actual =
    jest.requireActual<typeof import("@nestjs/swagger")>("@nestjs/swagger");
  return {
    ...actual,
    SwaggerModule: {
      createDocument: jest.fn(),
      setup: jest.fn(),
    },
  };
});

jest.mock("nestjs-zod", () => {
  const actual = jest.requireActual<typeof import("nestjs-zod")>("nestjs-zod");
  return {
    ...actual,
    cleanupOpenApiDoc: jest.fn((document: OpenAPIObject) => document),
  };
});

describe("setupOpenApi", () => {
  // Test double for an interface with no plain constructor; only the properties this test
  // touches are ever accessed.
  const app = Object.create(null) as INestApplication;
  const createDocumentMock = jest.mocked(SwaggerModule.createDocument);
  const setupMock = jest.mocked(SwaggerModule.setup);
  const cleanupMock = jest.mocked(cleanupOpenApiDoc);

  beforeEach(() => {
    jest.clearAllMocks();
    createDocumentMock.mockReturnValue(buildStubDocument());
  });

  it("builds the document, cleans it up and serves the Swagger UI", () => {
    const document = setupOpenApi(app, { title: "Service", version: "1.0.0" });
    const [, documentConfig] = createDocumentMock.mock.calls[0] ?? [];

    expect(documentConfig?.info).toMatchObject({
      title: "Service",
      version: "1.0.0",
    });
    const securitySchemes = documentConfig?.components?.securitySchemes ?? {};
    expect(securitySchemes[OPENAPI_DEFAULTS.BEARER_SCHEME_NAME]).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(cleanupMock).toHaveBeenCalled();
    expect(setupMock).toHaveBeenCalledWith(
      OPENAPI_DEFAULTS.SERVE_AT,
      app,
      document,
    );
  });

  it("serves the UI at a custom path when provided", () => {
    const document = setupOpenApi(app, {
      title: "Service",
      version: "1.0.0",
      serveAt: "api-docs",
    });

    expect(setupMock).toHaveBeenCalledWith("api-docs", app, document);
  });
});

describe("buildOpenApiDocument", () => {
  it("builds and cleans the document without serving the UI", () => {
    const app = Object.create(null) as INestApplication;
    const setupMock = jest.mocked(SwaggerModule.setup);
    setupMock.mockClear();
    const document = buildOpenApiDocument(app, { title: "S", version: "1" });
    expect(document).toBeDefined();
    expect(jest.mocked(cleanupOpenApiDoc)).toHaveBeenCalled();
    expect(setupMock).not.toHaveBeenCalled();
  });
});
