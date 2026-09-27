import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Observable } from "rxjs";
import { lastValueFrom, of, throwError } from "rxjs";

import { AppConfigService } from "@/config/app-config.service";
import { RequestLogInterceptor } from "@/common/interceptors/request-log.interceptor";
import { AppLogger } from "@/common/logger/app-logger.service";

function makeContext(
  request: FastifyRequest,
  reply: FastifyReply,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
      getNext: () => {
        throw new Error("not implemented");
      },
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(observable: Observable<unknown>): CallHandler {
  return { handle: () => observable };
}

describe("RequestLogInterceptor", () => {
  let logger: AppLogger;
  let interceptor: RequestLogInterceptor;
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);

    logger = new AppLogger(
      new AppConfigService({
        NODE_ENV: "test",
        PORT: 3000,
        LOG_LEVEL: "debug",
        LOG_FORMAT: "json",
        MONGO_URI: "mongodb://localhost:27017/app",
        REDIS_URL: "redis://localhost:6379",
        ACCESS_TOKEN_JWT_SECRET: "secret",
        ALLOWED_ORIGINS: [],
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_MAX: 300,
        RATE_LIMIT_WINDOW_MS: 60_000,
        TRUST_PROXY: false,
        SHUTDOWN_TIMEOUT_MS: 10_000,
      }),
    );
    interceptor = new RequestLogInterceptor(logger);
    infoSpy = jest.spyOn(logger, "info");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs http_request with status, method, path, and duration on success", async () => {
    const request = {
      id: "req-1",
      method: "GET",
      url: "/api/things?token=secret",
    } as unknown as FastifyRequest;
    const reply = { statusCode: 200 } as unknown as FastifyReply;

    const result = interceptor.intercept(
      makeContext(request, reply),
      makeHandler(of("ok")),
    );
    await lastValueFrom(result);

    const expectedFields = {
      requestId: "req-1",
      method: "GET",
      path: "/api/things",
      status: 200,
      durationMs: expect.any(Number) as number,
    };
    expect(infoSpy).toHaveBeenCalledWith(
      "http_request",
      expect.objectContaining(expectedFields),
    );
  });

  it("includes userId when present on the request's auth context", async () => {
    const request = {
      id: "req-2",
      method: "GET",
      url: "/api/me",
      auth: { userId: "u1" },
    } as unknown as FastifyRequest;
    const reply = { statusCode: 200 } as unknown as FastifyReply;

    const result = interceptor.intercept(
      makeContext(request, reply),
      makeHandler(of("ok")),
    );
    await lastValueFrom(result);

    expect(infoSpy).toHaveBeenCalledWith(
      "http_request",
      expect.objectContaining({ userId: "u1" }),
    );
  });

  it("logs the resolved status and rethrows on error with a getStatus() error", async () => {
    const request = {
      id: "req-3",
      method: "POST",
      url: "/api/things",
    } as unknown as FastifyRequest;
    const reply = { statusCode: 200 } as unknown as FastifyReply;
    const error = { getStatus: () => 403 };
    const result = interceptor.intercept(
      makeContext(request, reply),
      makeHandler(throwError(() => error)),
    );

    await expect(lastValueFrom(result)).rejects.toBe(error);

    expect(infoSpy).toHaveBeenCalledWith(
      "http_request",
      expect.objectContaining({ status: 403 }),
    );
  });

  it("logs the resolved status from an error's status field", async () => {
    const request = {
      id: "req-5",
      method: "POST",
      url: "/api/things",
    } as unknown as FastifyRequest;
    const reply = { statusCode: 200 } as unknown as FastifyReply;
    const error = { status: 409 };
    const result = interceptor.intercept(
      makeContext(request, reply),
      makeHandler(throwError(() => error)),
    );

    await expect(lastValueFrom(result)).rejects.toBe(error);

    expect(infoSpy).toHaveBeenCalledWith(
      "http_request",
      expect.objectContaining({ status: 409 }),
    );
  });

  it("falls back to status 500 when the error's status field is not a number", async () => {
    const request = {
      id: "req-6",
      method: "POST",
      url: "/api/things",
    } as unknown as FastifyRequest;
    const reply = { statusCode: 200 } as unknown as FastifyReply;
    const error = { status: "not-a-number" };
    const result = interceptor.intercept(
      makeContext(request, reply),
      makeHandler(throwError(() => error)),
    );

    await expect(lastValueFrom(result)).rejects.toBe(error);

    expect(infoSpy).toHaveBeenCalledWith(
      "http_request",
      expect.objectContaining({ status: 500 }),
    );
  });

  it("falls back to status 500 when a non-object value is thrown", async () => {
    const request = {
      id: "req-7",
      method: "POST",
      url: "/api/things",
    } as unknown as FastifyRequest;
    const reply = { statusCode: 200 } as unknown as FastifyReply;
    const result = interceptor.intercept(
      makeContext(request, reply),
      makeHandler(throwError(() => "boom")),
    );

    await expect(lastValueFrom(result)).rejects.toBe("boom");

    expect(infoSpy).toHaveBeenCalledWith(
      "http_request",
      expect.objectContaining({ status: 500 }),
    );
  });

  it("falls back to status 500 when the error carries no status", async () => {
    const request = {
      id: "req-4",
      method: "POST",
      url: "/api/things",
    } as unknown as FastifyRequest;
    const reply = { statusCode: 200 } as unknown as FastifyReply;

    const result = interceptor.intercept(
      makeContext(request, reply),
      makeHandler(throwError(() => new Error("boom"))),
    );

    await expect(lastValueFrom(result)).rejects.toThrow("boom");

    expect(infoSpy).toHaveBeenCalledWith(
      "http_request",
      expect.objectContaining({ status: 500 }),
    );
  });
});
