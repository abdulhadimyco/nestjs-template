import type { Writable } from "node:stream";

import { AppConfigService } from "@/config/app-config.service";
import type { AppEnv } from "@/config/env.schema";
import { AppLogger } from "@/common/logger/app-logger.service";
import { createPinoLogger } from "@/common/logger/pino.factory";

function makeConfig(logLevel: AppEnv["LOG_LEVEL"]): AppConfigService {
  return new AppConfigService({
    NODE_ENV: "test",
    PORT: 3000,
    LOG_LEVEL: logLevel,
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
  });
}

/**
 * Builds a pino destination stub that collects every written line for
 * assertions.
 *
 * @returns The stub stream, plus a `lines()` accessor over what it captured.
 */
function makeDestination(): {
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

function makeLogger(logLevel: AppEnv["LOG_LEVEL"]): {
  logger: AppLogger;
  lines: () => Record<string, unknown>[];
} {
  const { stream, lines } = makeDestination();
  const pinoInstance = createPinoLogger(makeConfig(logLevel), stream);

  return { logger: new AppLogger(makeConfig(logLevel), pinoInstance), lines };
}

function lastLine(
  lines: () => Record<string, unknown>[],
): Record<string, unknown> {
  const all = lines();
  const line = all.at(-1);

  if (line === undefined) {
    throw new Error("no line was written");
  }

  return line;
}

describe("AppLogger", () => {
  it("builds its own pino instance from the config service when none is supplied", () => {
    const stdoutSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    expect(() => {
      new AppLogger(makeConfig("debug")).info("boot");
    }).not.toThrow();

    stdoutSpy.mockRestore();
  });

  it("writes a single JSON line for a structured info call", () => {
    const { logger, lines } = makeLogger("debug");

    logger.info("user_created", { userId: "u1" });

    expect(lines()).toHaveLength(1);
    expect(lastLine(lines)).toMatchObject({
      level: "info",
      event: "user_created",
      userId: "u1",
    });
  });

  it("filters out lines below the configured level", () => {
    const { logger, lines } = makeLogger("warn");

    logger.info("ignored_event");
    logger.debug("also_ignored");
    logger.warn("kept_event");

    expect(lines()).toHaveLength(1);
    expect(lastLine(lines)).toMatchObject({ event: "kept_event" });
  });

  it("redacts sensitive fields on structured calls, case-insensitively and nested", () => {
    const { logger, lines } = makeLogger("debug");

    logger.info("login_attempt", {
      password: "hunter2",
      user: { Authorization: "Bearer x" },
    });

    expect(lastLine(lines)).toMatchObject({
      password: "[REDACTED]",
      user: { Authorization: "[REDACTED]" },
    });
  });

  it("attaches a serialised error on a structured error call", () => {
    const { logger, lines } = makeLogger("debug");

    logger.error("save_failed", { userId: "u1" }, new Error("db down"));

    const line = lastLine(lines);
    expect(line).toMatchObject({
      level: "error",
      event: "save_failed",
      userId: "u1",
    });
    expect(line["err"]).toMatchObject({ type: "Error", message: "db down" });
  });

  it("redacts sensitive fields on a non-Error attached error", () => {
    const { logger, lines } = makeLogger("debug");

    logger.error("save_failed", { userId: "u1" }, { token: "secret-token" });

    const line = lastLine(lines);
    expect(line["err"]).toMatchObject({ token: "[REDACTED]" });
  });

  it("merges bound child fields onto every line", () => {
    const { logger, lines } = makeLogger("debug");
    const child = logger.child({ requestId: "r1" });

    child.info("handled", { userId: "u1" });

    expect(lastLine(lines)).toMatchObject({ requestId: "r1", userId: "u1" });
  });

  it("redacts sensitive fields bound via child()", () => {
    const { logger, lines } = makeLogger("debug");
    const child = logger.child({ token: "child-secret" });

    child.info("handled");

    expect(lastLine(lines)).toMatchObject({ token: "[REDACTED]" });
  });

  it("does not throw when the payload is circular", () => {
    const { logger } = makeLogger("debug");
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;

    expect(() => {
      logger.info("weird_event", { circular });
    }).not.toThrow();
  });

  describe("Nest LoggerService compatibility", () => {
    it("supports log/debug/verbose/fatal with optional params", () => {
      const { logger, lines } = makeLogger("debug");

      logger.log("plain message", "extra", "params");
      logger.debug("debug message");
      logger.verbose("verbose message");
      logger.fatal("fatal message");

      expect(lines()).toHaveLength(4);
      expect(lastLine(lines)).toMatchObject({
        level: "fatal",
        event: "fatal message",
      });
    });

    it("maps a single string optional param to a context field", () => {
      const { logger, lines } = makeLogger("debug");

      logger.log("MongoModule dependencies initialized", "InstanceLoader");

      expect(lastLine(lines)).toMatchObject({
        event: "MongoModule dependencies initialized",
        context: "InstanceLoader",
      });
    });

    it("stringifies a non-string Nest log message", () => {
      const { logger, lines } = makeLogger("debug");

      logger.log(404);

      expect(lastLine(lines)).toMatchObject({ event: "404" });
    });

    it("supports warn(message, context)", () => {
      const { logger, lines } = makeLogger("debug");

      logger.warn("nest warning", "SomeContext");

      expect(lastLine(lines)).toMatchObject({
        level: "warn",
        event: "nest warning",
        context: "SomeContext",
      });
    });

    it("supports error(message, trace, context)", () => {
      const { logger, lines } = makeLogger("debug");

      logger.error("nest error", "trace-string", "SomeContext");

      expect(lastLine(lines)).toMatchObject({
        level: "error",
        event: "nest error",
        trace: "trace-string",
        context: "SomeContext",
      });
    });

    it("supports error(message, trace) without a context", () => {
      const { logger, lines } = makeLogger("debug");

      logger.error("nest error", "trace-string");

      expect(lastLine(lines)).toMatchObject({
        level: "error",
        trace: "trace-string",
      });
    });
  });
});
