import { z } from "zod";

/** Wildcard CORS origin, disallowed for `ALLOWED_ORIGINS` in production. */
const WILDCARD_ORIGIN = "*";

/**
 * Parses `TRUST_PROXY` into the shape Fastify's `trustProxy` option actually
 * accepts: `true` trusts every hop's `x-forwarded-for` entry (only correct
 * when nothing untrusted can sit between the client and the first hop),
 * `false` trusts none of it, an integer is the number of hops to trust
 * counting back from the service (the right choice behind a single edge
 * like Cloudflare: `1`), and a comma list is the set of trusted proxy
 * IPs/CIDRs. See `docs/CONVENTIONS.md` § Security for which form to use.
 *
 * @param value - The raw `TRUST_PROXY` string.
 * @returns The parsed value in Fastify's `trustProxy` shape.
 */
function parseTrustProxy(value: string): boolean | number | string[] {
  if (value === "true" || value === "false") {
    return value === "true";
  }

  return /^\d+$/.test(value)
    ? Number(value)
    : value
        .split(",")
        .map(entry => entry.trim())
        .filter(Boolean);
}

/**
 * Zod schema for every environment variable this service reads. This is the
 * only file allowed to read `process.env`.
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    LOG_FORMAT: z.enum(["json", "pretty"]).optional(),
    MONGO_URI: z.string().min(1),
    REDIS_URL: z.string().min(1),
    ACCESS_TOKEN_JWT_SECRET: z.string().min(1),
    JWT_EXPECTED_ISSUER: z.string().optional(),
    JWT_EXPECTED_AUDIENCE: z.string().optional(),
    ALLOWED_ORIGINS: z
      .string()
      .default("")
      .transform(value =>
        value
          .split(",")
          .map(origin => origin.trim())
          .filter(Boolean),
      ),
    RATE_LIMIT_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform(value => value === "true"),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    TRUST_PROXY: z.string().default("false").transform(parseTrustProxy),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") {
      return;
    }

    if (env.ACCESS_TOKEN_JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["ACCESS_TOKEN_JWT_SECRET"],
        message:
          "ACCESS_TOKEN_JWT_SECRET must be at least 32 characters in production",
      });
    }

    if (
      env.ALLOWED_ORIGINS.length === 0 ||
      env.ALLOWED_ORIGINS.includes(WILDCARD_ORIGIN)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOWED_ORIGINS"],
        message:
          "ALLOWED_ORIGINS must be a non-empty, non-wildcard list in production",
      });
    }

    if (env.LOG_LEVEL === "debug") {
      ctx.addIssue({
        code: "custom",
        path: ["LOG_LEVEL"],
        message: "LOG_LEVEL must not be debug in production",
      });
    }

    if (env.LOG_FORMAT === "pretty") {
      ctx.addIssue({
        code: "custom",
        path: ["LOG_FORMAT"],
        message: "LOG_FORMAT must be json in production",
      });
    }
  })
  .transform(env => ({
    ...env,
    LOG_FORMAT:
      env.LOG_FORMAT ??
      (env.NODE_ENV === "production" ? ("json" as const) : ("pretty" as const)),
  }));

/** The parsed, typed shape of this service's environment. */
export type AppEnv = z.infer<typeof envSchema>;

/**
 * Parses and validates a raw environment source against {@link envSchema}.
 *
 * @param source - The raw environment, typically `process.env`.
 * @returns The parsed, typed environment.
 * @throws {Error} Listing every invalid or missing key when parsing fails.
 */
export function parseEnv(source: NodeJS.ProcessEnv): AppEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
}
