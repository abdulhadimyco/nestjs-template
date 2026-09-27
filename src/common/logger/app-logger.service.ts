import type { LoggerService } from "@nestjs/common";
import { Injectable, Optional } from "@nestjs/common";
import type { Logger as PinoLogger } from "pino";

import { AppConfigService } from "@/config/app-config.service";
import { redact } from "@/common/logger/log-serializer.util";
import { createPinoLogger } from "@/common/logger/pino.factory";

/** Structured fields attached to a single log call. */
export type LogFields = Record<string, unknown>;

/** The pino levels this logger writes at. */
type PinoLevel = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Structured logger backed by pino. Implements Nest's {@link LoggerService}
 * for framework-driven logging, and additionally exposes typed
 * `info`/`warn`/`error` methods for application code. JSON in production,
 * `pino-pretty` colourised output otherwise, controlled by `LOG_FORMAT`.
 */
@Injectable()
export class AppLogger implements LoggerService {
  private readonly pino: PinoLogger;

  /**
   * Creates a logger, optionally wrapping an already-built pino instance
   * (used by {@link child}).
   *
   * @param configService - Supplies the configured log level and format.
   * @param pinoInstance - An existing pino instance to wrap, instead of
   * building a new one from `configService`.
   */
  constructor(
    private readonly configService: AppConfigService,
    // Not DI-provided: tests and child() pass it explicitly. @Optional() stops
    // Nest trying to resolve the bare parameter as a provider token.
    @Optional() pinoInstance?: PinoLogger,
  ) {
    this.pino = pinoInstance ?? createPinoLogger(configService);
  }

  /**
   * Writes one structured line at the given pino level. Redacts sensitive
   * fields ourselves as well, since pino's `redact` option cannot express
   * arbitrarily deep or dynamic key paths.
   *
   * @param level - The pino level to write at.
   * @param event - The event name.
   * @param fields - Optional structured fields to merge in.
   * @param err - An optional error to attach.
   */
  private write(
    level: PinoLevel,
    event: string,
    fields?: LogFields,
    err?: unknown,
  ): void {
    const mergingObject: LogFields = { ...(redact(fields ?? {}) as LogFields) };

    if (err !== undefined) {
      mergingObject["err"] = err instanceof Error ? err : redact(err);
    }

    this.pino[level](mergingObject, event);
  }

  /**
   * Returns a new logger with `context` merged into every subsequent line,
   * via pino's own `child()`.
   *
   * @param context - Fields to bind onto every line written by the child.
   * @returns A new {@link AppLogger} pre-bound with the merged fields.
   */
  public child(context: LogFields): AppLogger {
    return new AppLogger(
      this.configService,
      this.pino.child(redact(context) as LogFields),
    );
  }

  /**
   * Logs a structured informational event.
   *
   * @param event - A short, stable event name.
   * @param fields - Optional structured fields to attach.
   */
  public info(event: string, fields?: LogFields): void {
    this.write("info", event, fields);
  }

  /**
   * Logs a structured warning event, or satisfies Nest's
   * `LoggerService.warn(message, context?)` signature.
   *
   * @param first - The event name or Nest log message.
   * @param second - Structured fields, or Nest's string context.
   */
  public warn(first: unknown, second?: LogFields | string): void {
    const event = toEvent(first);

    if (second === undefined || typeof second === "object") {
      this.write("warn", event, second);
      return;
    }

    this.write("warn", event, { context: second });
  }

  /**
   * Logs a structured error event, or satisfies Nest's
   * `LoggerService.error(message, trace?, context?)` signature.
   *
   * @param first - The event name or Nest log message.
   * @param second - Structured fields, an error, or Nest's string trace.
   * @param third - The error to attach, when calling in structured form.
   */
  public error(
    first: unknown,
    second?: LogFields | string,
    third?: unknown,
  ): void {
    const event = toEvent(first);

    if (second === undefined || typeof second === "object") {
      this.write("error", event, second, third);
      return;
    }

    this.write("error", event, { trace: second, ...describeContext(third) });
  }

  /**
   * Satisfies Nest's `LoggerService.log`. Emits an `info`-level line.
   *
   * @param message - The Nest log message.
   * @param optionalParams - Any additional Nest-supplied parameters. When
   * this is a single string, it is treated as Nest's calling context.
   */
  public log(message: unknown, ...optionalParams: unknown[]): void {
    this.write("info", toEvent(message), toContextFields(optionalParams));
  }

  /**
   * Satisfies Nest's `LoggerService.debug`. Emits a `debug`-level line.
   *
   * @param message - The Nest log message.
   * @param optionalParams - Any additional Nest-supplied parameters. When
   * this is a single string, it is treated as Nest's calling context.
   */
  public debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write("debug", toEvent(message), toContextFields(optionalParams));
  }

  /**
   * Satisfies Nest's `LoggerService.verbose`. Emits a `debug`-level line, as
   * this logger has no dedicated verbose level.
   *
   * @param message - The Nest log message.
   * @param optionalParams - Any additional Nest-supplied parameters. When
   * this is a single string, it is treated as Nest's calling context.
   */
  public verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write("debug", toEvent(message), toContextFields(optionalParams));
  }

  /**
   * Satisfies Nest's `LoggerService.fatal`. Emits a `fatal`-level line.
   *
   * @param message - The Nest log message.
   * @param optionalParams - Any additional Nest-supplied parameters. When
   * this is a single string, it is treated as Nest's calling context.
   */
  public fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write("fatal", toEvent(message), toContextFields(optionalParams));
  }
}

/**
 * Normalises a Nest-style log message into a string event name.
 *
 * @param message - The raw value passed as a message.
 * @returns The message as a string.
 */
function toEvent(message: unknown): string {
  return typeof message === "string" ? message : String(message);
}

/**
 * Wraps Nest's variadic `optionalParams` into a structured field. A single
 * string param is Nest's calling context (e.g. a module or class name);
 * anything else is carried under `params` for visibility.
 *
 * @param optionalParams - The extra parameters Nest passed to a log call.
 * @returns Fields carrying the context or params, or `undefined` when there
 * are none.
 */
function toContextFields(optionalParams: unknown[]): LogFields | undefined {
  if (optionalParams.length === 1 && typeof optionalParams[0] === "string") {
    return { context: optionalParams[0] };
  }

  return optionalParams.length > 0 ? { params: optionalParams } : undefined;
}

/**
 * Builds the `context` field for the legacy `error(message, trace, context)`
 * call shape, when a string context was supplied.
 *
 * @param context - The raw third argument to `error`.
 * @returns Fields carrying the context, or an empty object.
 */
function describeContext(context: unknown): LogFields {
  return typeof context === "string" ? { context } : {};
}
