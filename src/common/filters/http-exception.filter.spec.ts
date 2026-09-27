import type { ArgumentsHost } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { AppConfigService } from "@/config/app-config.service";
import { HttpExceptionFilter } from "@/common/filters/http-exception.filter";
import { AppLogger } from "@/common/logger/app-logger.service";

function makeHost(request: FastifyRequest, reply: FastifyReply): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
      getNext: () => {
        throw new Error("not implemented");
      },
    }),
    getArgs: () => [],
    getArgByIndex: () => {
      throw new Error("not implemented");
    },
    switchToRpc: () => {
      throw new Error("not implemented");
    },
    switchToWs: () => {
      throw new Error("not implemented");
    },
    getType: () => "http",
  } as unknown as ArgumentsHost;
}

describe("HttpExceptionFilter", () => {
  let logger: AppLogger;
  let filter: HttpExceptionFilter;
  let send: jest.Mock;
  let status: jest.Mock;
  let request: FastifyRequest;
  let reply: FastifyReply;

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
    filter = new HttpExceptionFilter(logger);

    send = jest.fn();
    status = jest.fn(() => ({ send }));
    request = {
      id: "req-1",
      url: "/api/things",
      method: "GET",
    } as unknown as FastifyRequest;
    reply = { status } as unknown as FastifyReply;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the mapped status and body for an HttpException", () => {
    filter.catch(new HttpException("nope", 404), makeHost(request, reply));

    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_FOUND", requestId: "req-1" }),
    );
  });

  it("sends a generic 500 for an unrecognised exception", () => {
    filter.catch(new Error("boom"), makeHost(request, reply));

    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INTERNAL",
        message: "Internal server error",
      }),
    );
  });

  it("logs at warn for a 4xx status", () => {
    const warnSpy = jest.spyOn(logger, "warn");

    filter.catch(new HttpException("nope", 404), makeHost(request, reply));

    expect(warnSpy).toHaveBeenCalledWith(
      "handled_exception",
      expect.objectContaining({ requestId: "req-1" }),
    );
  });

  it("logs at error for a 5xx status", () => {
    const errorSpy = jest.spyOn(logger, "error");

    filter.catch(new Error("boom"), makeHost(request, reply));

    expect(errorSpy).toHaveBeenCalledWith(
      "unhandled_exception",
      expect.objectContaining({ requestId: "req-1" }),
      expect.any(Error),
    );
  });
});
