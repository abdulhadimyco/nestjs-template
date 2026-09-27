import { HttpException } from "@nestjs/common";

import { NotFoundError } from "@/common/errors/app.error";
import { mapExceptionToResponse } from "@/common/filters/exception-mapper.util";

describe("mapExceptionToResponse", () => {
  it("maps an AppError to its own status and code", () => {
    const result = mapExceptionToResponse(
      new NotFoundError("missing", { details: { id: "1" } }),
      "req-1",
    );

    expect(result).toEqual({
      status: 404,
      body: {
        code: "NOT_FOUND",
        message: "missing",
        details: { id: "1" },
        requestId: "req-1",
      },
    });
  });

  it("maps a Nest HttpException using the status-to-code table", () => {
    const exception = new HttpException("forbidden here", 403);

    const result = mapExceptionToResponse(exception, "req-2");

    expect(result.status).toBe(403);
    expect(result.body.code).toBe("FORBIDDEN");
    expect(result.body.requestId).toBe("req-2");
  });

  it("defaults an unmapped HttpException status to INTERNAL", () => {
    const exception = new HttpException("teapot", 418);

    const result = mapExceptionToResponse(exception, "req-3");

    expect(result.body.code).toBe("INTERNAL");
  });

  it("includes the HttpException object response as details", () => {
    const exception = new HttpException({ reason: "bad field" }, 400);

    const result = mapExceptionToResponse(exception, "req-4");

    expect(result.body.details).toEqual({ reason: "bad field" });
  });

  it("maps a duck-typed zod validation exception to VALIDATION_FAILED", () => {
    const issues = [{ path: ["name"], message: "Required" }];
    const zodLike = { getZodError: () => ({ issues }) };

    const result = mapExceptionToResponse(zodLike, "req-5");

    expect(result).toEqual({
      status: 400,
      body: {
        code: "VALIDATION_FAILED",
        message: "Validation failed",
        details: issues,
        requestId: "req-5",
      },
    });
  });

  it("maps any other unrecognised value to a generic 500", () => {
    const result = mapExceptionToResponse(new Error("boom"), "req-6");

    expect(result).toEqual({
      status: 500,
      body: {
        code: "INTERNAL",
        message: "Internal server error",
        requestId: "req-6",
      },
    });
  });
});
