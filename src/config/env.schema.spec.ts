import { parseEnv } from "@/config/env.schema";

describe("parseEnv", () => {
  const validEnv = {
    NODE_ENV: "test",
    PORT: "4000",
    LOG_LEVEL: "debug",
    MONGO_URI: "mongodb://localhost:27017/app",
    REDIS_URL: "redis://localhost:6379",
    ACCESS_TOKEN_JWT_SECRET: "secret",
    ALLOWED_ORIGINS: "http://a.test,http://b.test",
  };

  it("parses a valid environment", () => {
    const result = parseEnv(validEnv);

    expect(result.PORT).toBe(4000);
    expect(result.NODE_ENV).toBe("test");
  });

  it("throws naming the missing key when a required key is absent", () => {
    const rest: Record<string, string> = { ...validEnv };
    delete rest["ACCESS_TOKEN_JWT_SECRET"];

    expect(() => parseEnv(rest)).toThrow(/ACCESS_TOKEN_JWT_SECRET/);
  });

  it("splits ALLOWED_ORIGINS on commas", () => {
    const result = parseEnv(validEnv);

    expect(result.ALLOWED_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
  });

  it("defaults the new security keys when unset", () => {
    const result = parseEnv(validEnv);

    expect(result.RATE_LIMIT_MAX).toBe(300);
    expect(result.RATE_LIMIT_WINDOW_MS).toBe(60_000);
    expect(result.TRUST_PROXY).toBe(false);
    expect(result.SHUTDOWN_TIMEOUT_MS).toBe(10_000);
  });

  it("parses the new security keys when set", () => {
    const result = parseEnv({
      ...validEnv,
      RATE_LIMIT_MAX: "50",
      RATE_LIMIT_WINDOW_MS: "1000",
      TRUST_PROXY: "true",
      SHUTDOWN_TIMEOUT_MS: "5000",
    });

    expect(result.RATE_LIMIT_MAX).toBe(50);
    expect(result.RATE_LIMIT_WINDOW_MS).toBe(1000);
    expect(result.TRUST_PROXY).toBe(true);
    expect(result.SHUTDOWN_TIMEOUT_MS).toBe(5000);
  });

  describe("TRUST_PROXY", () => {
    it("defaults to false", () => {
      expect(parseEnv(validEnv).TRUST_PROXY).toBe(false);
    });

    it("parses the literal strings true and false", () => {
      expect(parseEnv({ ...validEnv, TRUST_PROXY: "true" }).TRUST_PROXY).toBe(
        true,
      );
      expect(parseEnv({ ...validEnv, TRUST_PROXY: "false" }).TRUST_PROXY).toBe(
        false,
      );
    });

    it("parses a numeric string as a hop count", () => {
      expect(parseEnv({ ...validEnv, TRUST_PROXY: "1" }).TRUST_PROXY).toBe(1);
      expect(parseEnv({ ...validEnv, TRUST_PROXY: "2" }).TRUST_PROXY).toBe(2);
    });

    it("parses a comma list as trusted proxy IPs/CIDRs", () => {
      expect(
        parseEnv({
          ...validEnv,
          TRUST_PROXY: "10.0.0.1, 10.0.0.2",
        }).TRUST_PROXY,
      ).toEqual(["10.0.0.1", "10.0.0.2"]);
    });

    it("parses a single CIDR entry as a one-element list", () => {
      expect(
        parseEnv({ ...validEnv, TRUST_PROXY: "192.168.1.0/24" }).TRUST_PROXY,
      ).toEqual(["192.168.1.0/24"]);
    });
  });

  describe("production hardening", () => {
    const validProdEnv = {
      ...validEnv,
      NODE_ENV: "production",
      LOG_LEVEL: "info",
      ACCESS_TOKEN_JWT_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://a.test",
    };

    it("accepts a compliant production environment", () => {
      expect(() => parseEnv(validProdEnv)).not.toThrow();
    });

    it("rejects a short ACCESS_TOKEN_JWT_SECRET in production", () => {
      expect(() =>
        parseEnv({ ...validProdEnv, ACCESS_TOKEN_JWT_SECRET: "short" }),
      ).toThrow(/ACCESS_TOKEN_JWT_SECRET.*production/i);
    });

    it("does not reject a short ACCESS_TOKEN_JWT_SECRET outside production", () => {
      expect(() =>
        parseEnv({ ...validEnv, ACCESS_TOKEN_JWT_SECRET: "short" }),
      ).not.toThrow();
    });

    it("rejects a wildcard ALLOWED_ORIGINS in production", () => {
      expect(() => parseEnv({ ...validProdEnv, ALLOWED_ORIGINS: "*" })).toThrow(
        /ALLOWED_ORIGINS.*production/i,
      );
    });

    it("rejects an empty ALLOWED_ORIGINS in production", () => {
      expect(() => parseEnv({ ...validProdEnv, ALLOWED_ORIGINS: "" })).toThrow(
        /ALLOWED_ORIGINS.*production/i,
      );
    });

    it("rejects LOG_LEVEL debug in production", () => {
      expect(() => parseEnv({ ...validProdEnv, LOG_LEVEL: "debug" })).toThrow(
        /LOG_LEVEL.*production/i,
      );
    });

    it("rejects an explicit LOG_FORMAT of pretty in production", () => {
      expect(() => parseEnv({ ...validProdEnv, LOG_FORMAT: "pretty" })).toThrow(
        /LOG_FORMAT.*production/i,
      );
    });
  });
});

describe("LOG_FORMAT", () => {
  const env = {
    MONGO_URI: "mongodb://localhost:27017/app",
    REDIS_URL: "redis://localhost:6379",
    ACCESS_TOKEN_JWT_SECRET: "secret",
    ALLOWED_ORIGINS: "http://a.test",
  };

  it("defaults to pretty outside production", () => {
    expect(parseEnv({ ...env, NODE_ENV: "development" }).LOG_FORMAT).toBe(
      "pretty",
    );
    expect(parseEnv({ ...env, NODE_ENV: "test" }).LOG_FORMAT).toBe("pretty");
  });

  it("defaults to json in production", () => {
    expect(
      parseEnv({
        ...env,
        NODE_ENV: "production",
        ACCESS_TOKEN_JWT_SECRET: "a".repeat(32),
        ALLOWED_ORIGINS: "https://a.test",
      }).LOG_FORMAT,
    ).toBe("json");
  });

  it("honours an explicit LOG_FORMAT outside production", () => {
    expect(
      parseEnv({ ...env, NODE_ENV: "development", LOG_FORMAT: "json" })
        .LOG_FORMAT,
    ).toBe("json");
  });
});

describe("RATE_LIMIT_ENABLED", () => {
  const env = {
    NODE_ENV: "test",
    MONGO_URI: "mongodb://localhost:27017/app",
    REDIS_URL: "redis://localhost:6379",
    ACCESS_TOKEN_JWT_SECRET: "secret",
    ALLOWED_ORIGINS: "http://a.test",
  };

  it("defaults to true and parses the string false", () => {
    expect(parseEnv(env).RATE_LIMIT_ENABLED).toBe(true);
    expect(
      parseEnv({ ...env, RATE_LIMIT_ENABLED: "false" }).RATE_LIMIT_ENABLED,
    ).toBe(false);
  });
});
