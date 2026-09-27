import { requestPath } from "@/common/utils/request-path.util";

describe("requestPath", () => {
  it("returns the path unchanged when there is no query or hash", () => {
    expect(requestPath("/api/v1/notes")).toBe("/api/v1/notes");
  });

  it("strips a query string", () => {
    expect(requestPath("/api/v1/notes?token=SECRET123")).toBe("/api/v1/notes");
  });

  it("strips a hash fragment", () => {
    expect(requestPath("/api/v1/notes#section")).toBe("/api/v1/notes");
  });

  it("strips both a query string and a hash fragment", () => {
    expect(requestPath("/api/v1/notes?token=SECRET123#section")).toBe(
      "/api/v1/notes",
    );
  });

  it("returns an empty string for a bare query string", () => {
    expect(requestPath("?token=SECRET123")).toBe("");
  });
});
