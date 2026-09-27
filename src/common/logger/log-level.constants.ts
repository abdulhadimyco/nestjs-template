/** The supported structured log levels, from least to most severe. */
export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;

/** A value of {@link LogLevel}. */
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Field names (case-insensitive, matched anywhere in an object graph) whose
 * values are redacted before a log line is serialised.
 */
export const REDACTED_FIELDS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "password",
  "token",
  "secret",
  "accesstoken",
  "refreshtoken",
] as const;
