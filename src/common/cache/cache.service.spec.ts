import RedisMock from "ioredis-mock";

import { CacheService } from "@/common/cache/cache.service";

describe("CacheService", () => {
  let service: CacheService;

  beforeEach(() => {
    service = new CacheService(new RedisMock());
  });

  it("returns undefined for a missing key", async () => {
    await expect(service.get("missing", String)).resolves.toBeUndefined();
  });

  it("sets and gets a value with a codec", async () => {
    await service.set("key", { a: 1 }, 60);

    await expect(
      service.get("key", raw => JSON.parse(raw) as { a: number }),
    ).resolves.toEqual({ a: 1 });
  });

  it("deletes keys", async () => {
    await service.set("key", "value", 60, String);
    await service.del("key");

    await expect(service.get("key", String)).resolves.toBeUndefined();
  });

  it("del is a no-op with no keys", async () => {
    await expect(service.del()).resolves.toBeUndefined();
  });

  it("getOrSet loads and caches on miss, then hits", async () => {
    let calls = 0;
    const loader = (): Promise<string> => {
      calls += 1;
      return Promise.resolve("loaded");
    };

    await expect(service.getOrSet("k", 60, loader)).resolves.toBe("loaded");
    await expect(service.getOrSet("k", 60, loader)).resolves.toBe("loaded");
    expect(calls).toBe(1);
  });

  it("getOrSet never caches a null result", async () => {
    let calls = 0;
    const loader = (): Promise<string | null> => {
      calls += 1;
      return Promise.resolve(null);
    };

    await expect(service.getOrSet("miss", 60, loader)).resolves.toBeNull();
    await expect(service.getOrSet("miss", 60, loader)).resolves.toBeNull();
    expect(calls).toBe(2);
  });

  it("getOrSet never caches an undefined result", async () => {
    let calls = 0;
    const loader = (): Promise<string | undefined> => {
      calls += 1;
      return Promise.resolve(undefined);
    };

    await expect(
      service.getOrSet("miss-2", 60, loader),
    ).resolves.toBeUndefined();
    await expect(
      service.getOrSet("miss-2", 60, loader),
    ).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });

  it("pings the client", async () => {
    await expect(service.ping()).resolves.toBe("PONG");
  });
});
