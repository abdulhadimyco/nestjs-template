import jwt from "jsonwebtoken";

import { AppConfigService } from "@/config/app-config.service";
import type { AppEnv } from "@/config/env.schema";
import { TokenService } from "@/common/auth/token.service";
import { UnauthorizedError } from "@/common/errors/app.error";

const baseEnv: AppEnv = {
  NODE_ENV: "test",
  PORT: 4000,
  LOG_LEVEL: "debug",
  LOG_FORMAT: "json",
  MONGO_URI: "mongodb://localhost:27017/app",
  REDIS_URL: "redis://localhost:6379",
  ACCESS_TOKEN_JWT_SECRET: "test-secret",
  ALLOWED_ORIGINS: [],
  RATE_LIMIT_ENABLED: true,
  RATE_LIMIT_MAX: 300,
  RATE_LIMIT_WINDOW_MS: 60_000,
  TRUST_PROXY: false,
  SHUTDOWN_TIMEOUT_MS: 10_000,
};

describe("TokenService", () => {
  it("returns the claims for a validly signed token", () => {
    const service = new TokenService(new AppConfigService(baseEnv));
    const token = jwt.sign({ sub: "user-1" }, baseEnv.ACCESS_TOKEN_JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1h",
    });

    const claims = service.verify(token);

    expect(claims.sub).toBe("user-1");
  });

  it("rejects a token signed with the none algorithm", () => {
    const service = new TokenService(new AppConfigService(baseEnv));
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "user-1" })).toString(
      "base64url",
    );
    const token = `${header}.${payload}.`;

    expect(() => service.verify(token)).toThrow(UnauthorizedError);
  });

  it("rejects an RS256-shaped token when the service expects HS256", () => {
    const service = new TokenService(new AppConfigService(baseEnv));
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "user-1" })).toString(
      "base64url",
    );
    const token = `${header}.${payload}.signature`;

    expect(() => service.verify(token)).toThrow(UnauthorizedError);
  });

  it("rejects an expired token", () => {
    const service = new TokenService(new AppConfigService(baseEnv));
    const token = jwt.sign({ sub: "user-1" }, baseEnv.ACCESS_TOKEN_JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: -10,
    });

    expect(() => service.verify(token)).toThrow(UnauthorizedError);
  });

  it("rejects a token whose payload decodes to a string, not an object", () => {
    const service = new TokenService(new AppConfigService(baseEnv));
    const token = jwt.sign(
      "plain-string-payload",
      baseEnv.ACCESS_TOKEN_JWT_SECRET,
      {
        algorithm: "HS256",
      },
    );

    expect(() => service.verify(token)).toThrow(UnauthorizedError);
  });

  it("rejects a validly signed token missing the sub claim", () => {
    const service = new TokenService(new AppConfigService(baseEnv));
    const token = jwt.sign({}, baseEnv.ACCESS_TOKEN_JWT_SECRET, {
      algorithm: "HS256",
    });

    expect(() => service.verify(token)).toThrow(UnauthorizedError);
  });

  it("rejects a validly signed token whose cognito:groups is a string, not an array", () => {
    const service = new TokenService(new AppConfigService(baseEnv));
    const token = jwt.sign(
      { sub: "user-1", "cognito:groups": "Admin" },
      baseEnv.ACCESS_TOKEN_JWT_SECRET,
      { algorithm: "HS256" },
    );

    expect(() => service.verify(token)).toThrow(UnauthorizedError);
  });

  it("rejects a malformed token", () => {
    const service = new TokenService(new AppConfigService(baseEnv));

    expect(() => service.verify("not-a-token")).toThrow(UnauthorizedError);
  });

  it("does not enforce issuer/audience when unset", () => {
    const service = new TokenService(new AppConfigService(baseEnv));
    const token = jwt.sign(
      { sub: "user-1", iss: "anything", aud: "anything" },
      baseEnv.ACCESS_TOKEN_JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" },
    );

    expect(() => service.verify(token)).not.toThrow();
  });

  it("enforces issuer and audience when configured", () => {
    const service = new TokenService(
      new AppConfigService({
        ...baseEnv,
        JWT_EXPECTED_ISSUER: "expected-issuer",
        JWT_EXPECTED_AUDIENCE: "expected-audience",
      }),
    );
    const validToken = jwt.sign(
      { sub: "user-1" },
      baseEnv.ACCESS_TOKEN_JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: "expected-issuer",
        audience: "expected-audience",
      },
    );
    const wrongIssuerToken = jwt.sign(
      { sub: "user-1" },
      baseEnv.ACCESS_TOKEN_JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: "wrong-issuer",
        audience: "expected-audience",
      },
    );

    expect(service.verify(validToken).sub).toBe("user-1");
    expect(() => service.verify(wrongIssuerToken)).toThrow(UnauthorizedError);
  });
});
