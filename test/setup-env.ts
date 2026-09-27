// eslint-disable-next-line no-restricted-properties
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "3000",
  LOG_LEVEL: "error",
  MONGO_URI: "mongodb://localhost:27017/app-test",
  REDIS_URL: "redis://localhost:6379/1",
  ACCESS_TOKEN_JWT_SECRET: "test-secret",
  ALLOWED_ORIGINS: "http://localhost:3000",
  LOG_FORMAT: "json",
  // The Redis-backed limiter needs a real Redis (Lua scripts); e2e uses ioredis-mock.
  RATE_LIMIT_ENABLED: "false",
});
