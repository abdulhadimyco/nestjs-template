import {
  AppError,
  ConflictError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  UpstreamError,
  ValidationError,
} from "@/common/errors/app.error";

describe("AppError", () => {
  it("carries the code, status, message, and details", () => {
    const error = new AppError("CONFLICT", 409, "already exists", {
      details: { id: "1" },
    });

    expect(error.code).toBe("CONFLICT");
    expect(error.status).toBe(409);
    expect(error.message).toBe("already exists");
    expect(error.details).toEqual({ id: "1" });
    expect(error.name).toBe("AppError");
  });

  it("passes cause through to the underlying Error", () => {
    const cause = new Error("root cause");

    const error = new AppError("INTERNAL", 500, "wrapped", { cause });

    expect(error.cause).toBe(cause);
  });

  it("leaves details undefined when not provided", () => {
    const error = new AppError("INTERNAL", 500, "no details");

    expect(error.details).toBeUndefined();
  });
});

describe.each([
  [ValidationError, "VALIDATION_FAILED", 400],
  [UnauthorizedError, "UNAUTHORIZED", 401],
  [ForbiddenError, "FORBIDDEN", 403],
  [NotFoundError, "NOT_FOUND", 404],
  [ConflictError, "CONFLICT", 409],
  [RateLimitedError, "RATE_LIMITED", 429],
  [UpstreamError, "UPSTREAM_FAILED", 502],
] as const)("%p", (errorClass, code, status) => {
  it(`maps to ${code}/${String(status)}`, () => {
    const error = new errorClass("message", { details: { a: 1 } });

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.name).toBe(errorClass.name);
    expect(error.details).toEqual({ a: 1 });
  });
});

describe("isAppError", () => {
  it("returns true for an AppError instance", () => {
    expect(isAppError(new NotFoundError("missing"))).toBe(true);
  });

  it("returns false for a plain Error", () => {
    expect(isAppError(new Error("plain"))).toBe(false);
  });

  it("returns false for a non-error value", () => {
    expect(isAppError({ code: "NOT_FOUND" })).toBe(false);
  });
});
