import request from "supertest";

import type { TestApp } from "./create-test-app";
import { createTestApp, signTestToken } from "./create-test-app";

describe("Notes (e2e)", () => {
  let testApp: TestApp;
  let noteId: string;
  const token = signTestToken({ sub: "user-1" });
  const otherUserToken = signTestToken({ sub: "user-2" });

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.stop();
  });

  it("rejects a request with no bearer token", async () => {
    const server = testApp.app.getHttpServer();

    const response = await request(server).get("/api/v1/notes").expect(401);

    expect(response.body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates a note", async () => {
    const server = testApp.app.getHttpServer();

    const response = await request(server)
      .post("/api/v1/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Title", body: "Body" })
      .expect(201);

    expect(response.body).toMatchObject({ title: "Title", body: "Body" });
    noteId = (response.body as { _id: string })._id;
  });

  it("gets the note by id", async () => {
    const server = testApp.app.getHttpServer();

    await request(server)
      .get(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }: { body: { title: string } }) => {
        expect(body.title).toBe("Title");
      });
  });

  it("returns 404 for another user's note on GET/PATCH/DELETE (IDOR)", async () => {
    const server = testApp.app.getHttpServer();

    await request(server)
      .get(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .expect(404);

    await request(server)
      .patch(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({ title: "Hijacked" })
      .expect(404);

    await request(server)
      .delete(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .expect(404);

    // The note is untouched: the owner still sees the original title.
    await request(server)
      .get(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }: { body: { title: string } }) => {
        expect(body.title).toBe("Title");
      });
  });

  it("lists notes owned by the caller", async () => {
    const server = testApp.app.getHttpServer();

    const response = await request(server)
      .get("/api/v1/notes")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  it("updates the note", async () => {
    const server = testApp.app.getHttpServer();

    await request(server)
      .patch(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated" })
      .expect(200)
      .expect(({ body }: { body: { title: string } }) => {
        expect(body.title).toBe("Updated");
      });
  });

  it("deletes the note", async () => {
    const server = testApp.app.getHttpServer();

    await request(server)
      .delete(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(server)
      .get(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("returns 400 for an invalid create body", async () => {
    const server = testApp.app.getHttpServer();

    await request(server)
      .post("/api/v1/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "" })
      .expect(400);
  });
});
