import type {
  DestinationStream,
  Logger,
  LoggerOptions,
  TransportSingleOptions,
} from "pino";
import pino from "pino";

import type { AppConfigService } from "@/config/app-config.service";
import type { AppEnv } from "@/config/env.schema";
import { REDACTED_FIELDS } from "@/common/logger/log-level.constants";

/** How many levels of nesting {@link buildRedactPaths} generates wildcard paths for. */
const REDACT_WILDCARD_DEPTH = 3;

/** Options passed to the `pino-pretty` transport when `LOG_FORMAT` is `pretty`. */
const PRETTY_TRANSPORT_OPTIONS = {
  colorize: true,
  translateTime: "HH:MM:ss.l",
  ignore: "pid,hostname",
  messageKey: "event",
  singleLine: false,
  messageFormat: "{if context}[{context}] {end}{event}",
};

/**
 * Builds the static `redact` paths pino should censor, covering each
 * {@link REDACTED_FIELDS} name at the top level and at a few levels of
 * nesting. Arbitrarily deep or dynamic nesting is instead handled by this
 * package's own recursive redaction in {@link "@/common/logger/log-serializer.util"}.
 *
 * @returns The list of static pino redaction paths.
 */
export function buildRedactPaths(): string[] {
  const prefixes: string[] = [];

  for (let depth = 0; depth <= REDACT_WILDCARD_DEPTH; depth += 1) {
    prefixes.push("*.".repeat(depth));
  }

  return prefixes.flatMap(prefix =>
    REDACTED_FIELDS.map(field => `${prefix}${field}`),
  );
}

/**
 * Resolves the pino `transport` option for the configured log format.
 * Pino only loads `pino-pretty` (in a worker thread) when this option is
 * present, so it is never loaded for the `json` format.
 *
 * @param logFormat - The configured log format.
 * @returns The transport config for `pretty`, or `undefined` for `json`.
 */
export function resolvePinoTransport(
  logFormat: AppEnv["LOG_FORMAT"],
): TransportSingleOptions | undefined {
  return logFormat !== "pretty"
    ? undefined
    : { target: "pino-pretty", options: PRETTY_TRANSPORT_OPTIONS };
}

/**
 * Creates the pino instance backing {@link "@/common/logger/app-logger.service"}.
 *
 * @param configService - Supplies the configured log level and format.
 * @param destination - A test destination stream. When provided, the format
 * is forced to plain JSON, since pino disallows combining a destination with
 * a transport.
 * @returns A configured pino logger.
 */
export function createPinoLogger(
  configService: AppConfigService,
  destination?: DestinationStream,
): Logger {
  const options: LoggerOptions = {
    level: configService.logLevel,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: "event",
    redact: { paths: buildRedactPaths(), censor: "[REDACTED]" },
    serializers: { err: pino.stdSerializers.err },
    formatters: { level: label => ({ level: label }) },
  };

  const transport = destination
    ? undefined
    : resolvePinoTransport(configService.logFormat);

  if (transport) {
    options.transport = transport;
  }

  return destination ? pino(options, destination) : pino(options);
}
