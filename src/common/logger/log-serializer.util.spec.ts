import type { LogLine } from "@/common/logger/log-serializer.util";
import {
  redact,
  serializeError,
  serializeLogLine,
} from "@/common/logger/log-serializer.util";

describe("redact", () => {
  it("redacts a matching top-level field", () => {
    expect(redact({ password: "hunter2", ok: "fine" })).toEqual({
      password: "[REDACTED]",
      ok: "fine",
    });
  });

  it("redacts matching fields regardless of case", () => {
    expect(redact({ Authorization: "Bearer x", COOKIE: "a=b" })).toEqual({
      Authorization: "[REDACTED]",
      COOKIE: "[REDACTED]",
    });
  });

  it("redacts nested fields", () => {
    expect(redact({ user: { token: "abc", name: "ada" } })).toEqual({
      user: { token: "[REDACTED]", name: "ada" },
    });
  });

  it("redacts fields inside arrays", () => {
    expect(redact([{ secret: "s1" }, { secret: "s2" }])).toEqual([
      { secret: "[REDACTED]" },
      { secret: "[REDACTED]" },
    ]);
  });

  it("replaces a self-referencing object with a placeholder instead of recursing forever", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;

    expect(redact(circular)).toEqual({ self: "[Circular]" });
  });

  it("replaces a circular array with a placeholder instead of recursing forever", () => {
    const circular: unknown[] = [];
    circular.push(circular);

    expect(redact(circular)).toEqual(["[Circular]"]);
  });

  it("does not treat the same object appearing twice at different branches as circular", () => {
    const shared = { name: "ada" };

    expect(redact({ a: shared, b: shared })).toEqual({
      a: { name: "ada" },
      b: { name: "ada" },
    });
  });

  it("passes through primitives unchanged", () => {
    expect(redact("plain")).toBe("plain");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
  });
});

describe("serializeError", () => {
  it("serialises a real Error with its stack", () => {
    const error = new Error("boom");

    const result = serializeError(error);

    expect(result.name).toBe("Error");
    expect(result.message).toBe("boom");
    expect(result.stack).toEqual(expect.any(String));
  });

  it("omits the stack when an Error instance has none", () => {
    const error = new Error("no stack");
    delete error.stack;

    expect(serializeError(error)).toEqual({
      name: "Error",
      message: "no stack",
    });
  });

  it("serialises a string thrown value", () => {
    expect(serializeError("plain failure")).toEqual({
      name: "UnknownError",
      message: "plain failure",
    });
  });

  it("serialises a non-Error, non-string thrown value", () => {
    expect(serializeError({ reason: "bad" })).toEqual({
      name: "UnknownError",
      message: JSON.stringify({ reason: "bad" }),
    });
  });

  it("falls back to a placeholder when the thrown value cannot be stringified", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;

    expect(serializeError(circular)).toEqual({
      name: "UnknownError",
      message: "[Unserializable value]",
    });
  });
});

describe("serializeLogLine", () => {
  const baseLine: LogLine = {
    ts: "2026-01-01T00:00:00.000Z",
    level: "info",
    event: "test_event",
  };

  it("serialises a plain line to JSON", () => {
    const result = serializeLogLine(baseLine);

    expect(JSON.parse(result)).toEqual(baseLine);
  });

  it("redacts sensitive fields before serialising", () => {
    const result = serializeLogLine({ ...baseLine, password: "hunter2" });

    expect(JSON.parse(result)).toMatchObject({ password: "[REDACTED]" });
  });

  it("replaces a circular reference with a placeholder instead of throwing", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;

    const result = serializeLogLine({ ...baseLine, circular });

    expect(JSON.parse(result)).toMatchObject({
      ts: baseLine.ts,
      level: baseLine.level,
      event: baseLine.event,
      circular: { self: "[Circular]" },
    });
  });

  it("falls back to a minimal line when serialisation still throws", () => {
    // BigInt survives redaction unchanged (it isn't a plain object) but
    // JSON.stringify has no representation for it and throws.
    const result = serializeLogLine({ ...baseLine, unsupported: 1n });
    const parsed: unknown = JSON.parse(result);

    expect(parsed).toMatchObject({
      ts: baseLine.ts,
      level: baseLine.level,
      event: baseLine.event,
      err: { name: "SerializationError" },
    });
  });
});
