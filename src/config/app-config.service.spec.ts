import { AppConfigService } from "@/config/app-config.service";
import type { AppEnv } from "@/config/env.schema";

describe("AppConfigService", () => {
  const baseEnv: AppEnv = {
    NODE_ENV: "development",
    PORT: 4000,
    LOG_LEVEL: "debug",
    LOG_FORMAT: "json",
    MONGO_URI: "mongodb://localhost:27017/app",
    REDIS_URL: "redis://localhost:6379",
    ACCESS_TOKEN_JWT_SECRET: "secret",
    ALLOWED_ORIGINS: ["https://a.test"],
    RATE_LIMIT_ENABLED: true,
    RATE_LIMIT_MAX: 300,
    RATE_LIMIT_WINDOW_MS: 60_000,
    TRUST_PROXY: false,
    SHUTDOWN_TIMEOUT_MS: 10_000,
  };

  it("exposes typed getters for every configured value", () => {
    const service = new AppConfigService(baseEnv);

    expect(service.port).toBe(4000);
    expect(service.nodeEnv).toBe("development");
    expect(service.isProduction).toBe(false);
    expect(service.logLevel).toBe("debug");
    expect(service.logFormat).toBe("json");
    expect(service.mongoUri).toBe(baseEnv.MONGO_URI);
    expect(service.redisUrl).toBe(baseEnv.REDIS_URL);
    expect(service.allowedOrigins).toEqual(["https://a.test"]);
    expect(service.rateLimit).toEqual({
      enabled: true,
      max: 300,
      windowMs: 60_000,
    });
    expect(service.trustProxy).toBe(false);
    expect(service.shutdownTimeoutMs).toBe(10_000);
  });

  it("exposes a hop count or IP/CIDR list from a non-boolean TRUST_PROXY", () => {
    const hopCountService = new AppConfigService({
      ...baseEnv,
      TRUST_PROXY: 1,
    });
    const cidrListService = new AppConfigService({
      ...baseEnv,
      TRUST_PROXY: ["10.0.0.1"],
    });

    expect(hopCountService.trustProxy).toBe(1);
    expect(cidrListService.trustProxy).toEqual(["10.0.0.1"]);
  });

  it("reports production when NODE_ENV is production", () => {
    const service = new AppConfigService({
      ...baseEnv,
      NODE_ENV: "production",
    });

    expect(service.isProduction).toBe(true);
  });

  it("omits issuer and audience from the jwt config when unset", () => {
    const service = new AppConfigService(baseEnv);

    expect(service.jwt).toEqual({ secret: "secret" });
  });

  it("includes issuer and audience in the jwt config when set", () => {
    const service = new AppConfigService({
      ...baseEnv,
      JWT_EXPECTED_ISSUER: "issuer",
      JWT_EXPECTED_AUDIENCE: "audience",
    });

    expect(service.jwt).toEqual({
      secret: "secret",
      issuer: "issuer",
      audience: "audience",
    });
  });
});
