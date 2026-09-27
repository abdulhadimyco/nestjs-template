import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import RedisMock from "ioredis-mock";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";

import { REDIS_CLIENT } from "@/common/cache/cache.constants";

import { AppModule } from "@/app.module";
import { configureApp, createFastifyAdapter } from "@/app.setup";

/** A booted test application plus the handle needed to tear it down. */
export type TestApp = {
  /** The running Nest application (never listening on a port). */
  app: NestFastifyApplication;
  /** Stops the app and the in-memory Mongo server. */
  stop: () => Promise<void>;
};

/**
 * Boots the REAL `AppModule` (guards, pipes, filters, interceptors included)
 * through the same `configureApp()` production uses (Helmet, CORS, rate
 * limit, request-id, prefix, versioning, OpenAPI) against an in-memory Mongo
 * and a mocked Redis, so e2e tests are hermetic and exercise the real edge.
 *
 * `MONGO_URI` is set before the module compiles because `AppConfigModule`
 * parses the environment at compile time.
 *
 * @returns The application and a `stop` function for `afterAll`.
 */
export async function createTestApp(): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create();
  // eslint-disable-next-line no-restricted-properties
  process.env["MONGO_URI"] = mongo.getUri();

  const moduleReference = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(REDIS_CLIENT)
    .useValue(new RedisMock())
    .compile();

  const app = moduleReference.createNestApplication<NestFastifyApplication>(
    createFastifyAdapter(false),
  );
  await configureApp(app, { serveDocs: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    stop: async (): Promise<void> => {
      await app.close();
      await mongo.stop();
    },
  };
}

/**
 * Signs an HS256 access token that `JwtAuthGuard` accepts under the test
 * environment's `ACCESS_TOKEN_JWT_SECRET`.
 *
 * @param claims - Claims to embed; `sub` is required, add `"cognito:groups": ["Admin"]` for an admin.
 * @returns A bearer token string (without the `Bearer ` prefix).
 */
export function signTestToken(
  claims: { sub: string } & Record<string, unknown>,
): string {
  // eslint-disable-next-line no-restricted-properties
  const secret = process.env["ACCESS_TOKEN_JWT_SECRET"] ?? "";
  return jwt.sign(claims, secret, { algorithm: "HS256", expiresIn: "5m" });
}
