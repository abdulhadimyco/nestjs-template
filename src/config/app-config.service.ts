import { Injectable } from "@nestjs/common";

import type { AppEnv } from "@/config/env.schema";

/** Typed JWT configuration exposed by {@link AppConfigService}. */
export type JwtConfig = {
  secret: string;
  issuer?: string;
  audience?: string;
};

/** Typed rate-limit configuration exposed by {@link AppConfigService}. */
export type RateLimitConfig = {
  /** `false` when an edge limiter (e.g. Cloudflare) already covers this service. */
  enabled: boolean;
  max: number;
  windowMs: number;
};

/**
 * Typed accessor for the service's environment configuration. This is the
 * only way the rest of the app should read configuration values.
 */
@Injectable()
export class AppConfigService {
  /**
   * Creates the config service from an already-parsed environment.
   *
   * @param env - The parsed, typed environment.
   */
  constructor(private readonly env: AppEnv) {}

  /**
   * The HTTP port the service listens on.
   *
   * @returns The configured port.
   */
  public get port(): number {
    return this.env.PORT;
  }

  /**
   * The current `NODE_ENV` value.
   *
   * @returns The configured node environment.
   */
  public get nodeEnv(): AppEnv["NODE_ENV"] {
    return this.env.NODE_ENV;
  }

  /**
   * Whether the service is running in production.
   *
   * @returns True when `NODE_ENV` is `production`.
   */
  public get isProduction(): boolean {
    return this.env.NODE_ENV === "production";
  }

  /**
   * The configured log level.
   *
   * @returns The configured log level.
   */
  public get logLevel(): AppEnv["LOG_LEVEL"] {
    return this.env.LOG_LEVEL;
  }

  /**
   * The configured log output format: `json` in production, `pretty`
   * (human-readable, colourised) otherwise, unless overridden.
   *
   * @returns The configured log format.
   */
  public get logFormat(): AppEnv["LOG_FORMAT"] {
    return this.env.LOG_FORMAT;
  }

  /**
   * The Mongo connection string.
   *
   * @returns The configured Mongo URI.
   */
  public get mongoUri(): string {
    return this.env.MONGO_URI;
  }

  /**
   * The Redis connection string.
   *
   * @returns The configured Redis URL.
   */
  public get redisUrl(): string {
    return this.env.REDIS_URL;
  }

  /**
   * The JWT verification configuration.
   *
   * @returns The JWT secret plus optional issuer/audience.
   */
  public get jwt(): JwtConfig {
    return {
      secret: this.env.ACCESS_TOKEN_JWT_SECRET,
      ...(this.env.JWT_EXPECTED_ISSUER !== undefined
        ? { issuer: this.env.JWT_EXPECTED_ISSUER }
        : {}),
      ...(this.env.JWT_EXPECTED_AUDIENCE !== undefined
        ? { audience: this.env.JWT_EXPECTED_AUDIENCE }
        : {}),
    };
  }

  /**
   * The list of origins allowed by CORS.
   *
   * @returns The configured allowed origins.
   */
  public get allowedOrigins(): string[] {
    return this.env.ALLOWED_ORIGINS;
  }

  /**
   * The rate-limit configuration applied to every route.
   *
   * @returns The configured request cap and time window.
   */
  public get rateLimit(): RateLimitConfig {
    return {
      enabled: this.env.RATE_LIMIT_ENABLED,
      max: this.env.RATE_LIMIT_MAX,
      windowMs: this.env.RATE_LIMIT_WINDOW_MS,
    };
  }

  /**
   * How much of the `x-forwarded-for` chain the service trusts for the
   * client IP, in Fastify's own `trustProxy` shape: `true` trusts every hop,
   * `false` trusts none, a number is a hop count (use `1` behind a single
   * edge like Cloudflare), and a string array is a set of trusted proxy
   * IPs/CIDRs. `true` behind an untrusted or absent edge lets a client spoof
   * its own rate-limit key — see `docs/CONVENTIONS.md` § Security.
   *
   * @returns The configured trust-proxy value.
   */
  public get trustProxy(): boolean | number | string[] {
    return this.env.TRUST_PROXY;
  }

  /**
   * How long Nest waits for in-flight requests to finish on shutdown before
   * forcing the process to exit.
   *
   * @returns The configured shutdown timeout, in milliseconds.
   */
  public get shutdownTimeoutMs(): number {
    return this.env.SHUTDOWN_TIMEOUT_MS;
  }
}
