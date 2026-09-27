import request from "supertest";

import type { TestApp } from "./create-test-app";
import { createTestApp } from "./create-test-app";

describe("Health (e2e)", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.stop();
  });

  it("GET /api/healthz is public and returns ok", async () => {
    const response = await request(testApp.app.getHttpServer()).get(
      "/api/healthz",
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", mongo: "up" });
  });

  it("a guarded route without a token returns 401 with the error contract", async () => {
    const response = await request(testApp.app.getHttpServer()).get(
      "/api/v1/notes",
    );
    expect(response.status).toBe(401);
    const body: unknown = response.body;
    expect(body).toMatchObject({ code: "UNAUTHORIZED" });
    expect(typeof (body as { requestId?: unknown }).requestId).toBe("string");
  });
});
