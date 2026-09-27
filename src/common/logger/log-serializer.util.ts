import type { LogLevel } from "@/common/logger/log-level.constants";
import { REDACTED_FIELDS } from "@/common/logger/log-level.constants";

/** Placeholder written in place of a redacted field's value. */
const REDACTED_PLACEHOLDER = "[REDACTED]";

/** The serialised shape of an error attached to a log line. */
export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
};

/** A single JSON log line as written to stdout. */
export type LogLine = {
  ts: string;
  level: LogLevel;
  event: string;
  err?: SerializedError;
  [field: string]: unknown;
};

const REDACTED_FIELD_SET = new Set<string>(
  REDACTED_FIELDS.map(field => field.toLowerCase()),
);

/** Placeholder written in place of an object already seen up this branch. */
const CIRCULAR_PLACEHOLDER = "[Circular]";

/**
 * Recursively redacts any object field whose key matches
 * {@link REDACTED_FIELDS}, case-insensitively. Safe against circular
 * references: an object already seen higher up the same branch is replaced
 * with a placeholder instead of being walked again.
 *
 * @param value - The value to redact, at any nesting depth.
 * @returns A deep copy of `value` with matching fields replaced.
 */
export function redact(value: unknown): unknown {
  return redactSeen(value, new WeakSet());
}

/**
 * The recursive implementation behind {@link redact}, threading a `seen` set
 * through every call to break cycles.
 *
 * @param value - The value to redact, at any nesting depth.
 * @param seen - Objects already visited on this branch.
 * @returns A deep copy of `value` with matching fields replaced.
 */
function redactSeen(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return redactContainer(value, seen, () =>
      value.map(item => redactSeen(item, seen)),
    );
  }

  return value !== null && typeof value === "object"
    ? redactContainer(value, seen, () =>
        redactObject(value as Record<string, unknown>, seen),
      )
    : value;
}

/**
 * Guards a container value against re-entering itself, marking it seen
 * before recursing into `build`.
 *
 * @param container - The object or array about to be walked.
 * @param seen - Objects already visited on this branch.
 * @param build - Produces the redacted copy when `container` is new.
 * @returns The redacted copy, or {@link CIRCULAR_PLACEHOLDER} when
 * `container` was already being visited on this branch.
 */
function redactContainer(
  container: object,
  seen: WeakSet<object>,
  build: () => unknown,
): unknown {
  if (seen.has(container)) {
    return CIRCULAR_PLACEHOLDER;
  }

  seen.add(container);

  try {
    return build();
  } finally {
    seen.delete(container);
  }
}

/**
 * Redacts the own enumerable fields of a plain object.
 *
 * @param source - The object to redact.
 * @param seen - Objects already visited on this branch.
 * @returns A new object with matching fields replaced.
 */
function redactObject(
  source: Record<string, unknown>,
  seen: WeakSet<object>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    result[key] = REDACTED_FIELD_SET.has(key.toLowerCase())
      ? REDACTED_PLACEHOLDER
      : redactSeen(value, seen);
  }

  return result;
}

/**
 * Converts an unknown thrown value into a {@link SerializedError}.
 *
 * @param err - The value to serialise, typically an `Error` or `unknown`.
 * @returns A plain object describing the error.
 */
export function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      ...(err.stack !== undefined ? { stack: err.stack } : {}),
    };
  }

  return {
    name: "UnknownError",
    message: typeof err === "string" ? err : safeStringify(err),
  };
}

/**
 * Stringifies an arbitrary value, falling back to a placeholder when
 * serialisation itself throws (e.g. circular references).
 *
 * @param value - The value to stringify.
 * @returns The JSON string, or a fallback description.
 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[Unserializable value]";
  }
}

/**
 * Builds the final JSON string for one log line, redacting sensitive fields
 * and never throwing.
 *
 * @param line - The structured log line to serialise.
 * @returns A single JSON-encoded line, without a trailing newline.
 */
export function serializeLogLine(line: LogLine): string {
  try {
    const redacted = redact(line) as Record<string, unknown>;
    return JSON.stringify(redacted);
  } catch {
    return fallbackLine(line);
  }
}

/**
 * Produces a minimal, guaranteed-serialisable fallback line for cases where
 * the real payload could not be serialised.
 *
 * @param line - The original log line that failed to serialise.
 * @returns A minimal JSON string carrying only the safe top-level fields.
 */
function fallbackLine(line: LogLine): string {
  return JSON.stringify({
    ts: line.ts,
    level: line.level,
    event: line.event,
    err: {
      name: "SerializationError",
      message: "Failed to serialize log line",
    },
  });
}
