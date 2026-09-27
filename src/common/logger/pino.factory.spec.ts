import type { Writable } from "node:stream";

import { AppConfigService } from "@/config/app-config.service";
import type { AppEnv } from "@/config/env.schema";
import { REDACTED_FIELDS } from "@/common/logger/log-level.constants";
import {
  buildRedactPaths,
  createPinoLogger,
  resolvePinoTransport,
} from "@/common/logger/pino.factory";

function makeConfig(
  logLevel: AppEnv["LOG_LEVEL"] = "debug",
  logFormat: AppEnv["LOG_FORMAT"] = "json",
): AppConfigService {
  return new AppConfigService({
    NODE_ENV: "test",
    PORT: 3000,
    LOG_LEVEL: logLevel,
    LOG_FORMAT: logFormat,
    MONGO_URI: "mongodb://localhost:27017/app",
    REDIS_URL: "redis://localhost:6379",
    ACCESS_TOKEN_JWT_SECRET: "secret",
    ALLOWED_ORIGINS: [],
    RATE_LIMIT_ENABLED: true,
    RATE_LIMIT_MAX: 300,
    RATE_LIMIT_WINDOW_MS: 60_000,
    TRUST_PROXY: false,
    SHUTDOWN_TIMEOUT_MS: 10_000,
  });
}

function makeCollectingStream(): {
  stream: Writable;
  lines: () => Record<string, unknown>[];
} {
  const chunks: string[] = [];
  const stream = {
    write: (chunk: string): boolean => {
      chunks.push(chunk);
      return true;
    },
  } as unknown as Writable;

  return {
    stream,
    lines: () =>
      chunks
        .join("")
        .split("\n")
        .filter(Boolean)
        .map(line => JSON.parse(line) as Record<string, unknown>),
  };
}

describe("resolvePinoTransport", () => {
  it("returns undefined for the json format", () => {
    expect(resolvePinoTransport("json")).toBeUndefined();
  });

  it("returns a pino-pretty transport config for the pretty format", () => {
    const transport = resolvePinoTransport("pretty");

    expect(transport).toMatchObject({ target: "pino-pretty" });
    expect(transport?.options).toMatchObject({
      colorize: true,
      messageKey: "event",
    });
  });
});

describe("buildRedactPaths", () => {
  it("includes every redacted field at the top level and nested", () => {
    const paths = buildRedactPaths();

    expect(paths).toContain("authorization");
    expect(paths).toContain("*.authorization");
    expect(paths).toContain("*.*.authorization");
    expect(paths).toHaveLength(REDACTED_FIELDS.length * 4);
  });
});

describe("createPinoLogger", () => {
  it("writes level-labelled JSON lines with an ISO timestamp under the 'event' message key", () => {
    const { stream, lines } = makeCollectingStream();
    const logger = createPinoLogger(makeConfig(), stream);

    logger.info({ userId: "u1" }, "user_created");

    const [line] = lines();
    expect(line).toMatchObject({
      level: "info",
      event: "user_created",
      userId: "u1",
    });
    expect(typeof line?.["time"]).toBe("string");
  });

  it("filters lines below the configured level", () => {
    const { stream, lines } = makeCollectingStream();
    const logger = createPinoLogger(makeConfig("warn"), stream);

    logger.info({}, "ignored");
    logger.warn({}, "kept");

    expect(lines()).toHaveLength(1);
  });

  it("redacts a statically known field via pino's own redact option", () => {
    const { stream, lines } = makeCollectingStream();
    const logger = createPinoLogger(makeConfig(), stream);

    logger.info({ password: "hunter2" }, "login");

    expect(lines()[0]).toMatchObject({ password: "[REDACTED]" });
  });

  it("serialises an attached Error via pino's std serializer", () => {
    const { stream, lines } = makeCollectingStream();
    const logger = createPinoLogger(makeConfig(), stream);

    logger.error({ err: new Error("boom") }, "failed");

    expect(lines()[0]?.["err"]).toMatchObject({
      type: "Error",
      message: "boom",
    });
  });

  it("builds a real logger when no destination is supplied", () => {
    const stdoutSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const logger = createPinoLogger(makeConfig());
    logger.info("no_destination");

    expect(stdoutSpy).toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it("ignores the configured transport when a destination is supplied", () => {
    const { stream, lines } = makeCollectingStream();

    expect(() =>
      createPinoLogger(makeConfig("debug", "pretty"), stream),
    ).not.toThrow();

    const logger = createPinoLogger(makeConfig("debug", "pretty"), stream);
    logger.info({}, "still_json");

    expect(lines().at(-1)).toMatchObject({ event: "still_json" });
  });
});
