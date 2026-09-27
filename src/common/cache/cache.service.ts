import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";

import { REDIS_CLIENT } from "@/common/cache/cache.constants";
import type { Codec } from "@/common/cache/json-codec.util";
import { createJsonCodec } from "@/common/cache/json-codec.util";

/**
 * Thin, typed wrapper around the shared Redis client. All cache reads/writes
 * go through here so key hygiene (no `SCAN`-based deletes — every delete is
 * by explicit key) and (de)serialization stay in one place.
 */
@Injectable()
export class CacheService {
  /**
   * Creates the cache service.
   *
   * @param redis - The shared `ioredis` client.
   */
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Reads and parses a cached value.
   *
   * @param key - The cache key.
   * @param parse - Turns the raw stored string into `T`.
   * @returns The parsed value, or `undefined` when the key is missing.
   */
  public async get<T>(
    key: string,
    parse: (raw: string) => T,
  ): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    return raw === null ? undefined : parse(raw);
  }

  /**
   * Serializes and stores a value with a TTL.
   *
   * @param key - The cache key.
   * @param value - The value to store.
   * @param ttlSeconds - Seconds until the key expires.
   * @param serialize - Turns `value` into a string. Defaults to `JSON.stringify`.
   * @returns A promise that resolves once the value is stored.
   */
  public async set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    serialize: (value: T) => string = JSON.stringify,
  ): Promise<void> {
    await this.redis.set(key, serialize(value), "EX", ttlSeconds);
  }

  /**
   * Deletes one or more keys. Uses `UNLINK` (non-blocking) rather than
   * `DEL`. Only ever called with explicit keys — this codebase never does a
   * `SCAN`-based bulk delete, since scans are O(keyspace) and unsafe on a
   * shared production Redis instance.
   *
   * @param keys - The keys to remove.
   * @returns A promise that resolves once the keys are removed.
   */
  public async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    await this.redis.unlink(...keys);
  }

  /**
   * The single "cached read" primitive: returns the cached value when
   * present, otherwise loads it, caches it, and returns it. Negative
   * results — the loader resolving `null` or `undefined` — are never
   * cached: a miss (a 404, a not-yet-existing slug) always re-checks the
   * source of truth on the next call, instead of being pinned for the
   * whole TTL.
   *
   * @param key - The cache key.
   * @param ttlSeconds - Seconds until the cached value expires.
   * @param loader - Loads the value on a cache miss.
   * @param codec - Optional custom (de)serializer. Defaults to a plain JSON codec.
   * @returns The cached or freshly loaded value.
   */
  public async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
    codec: Codec<T> = createJsonCodec<T>(),
  ): Promise<T> {
    const cached = await this.get(key, codec.parse);

    if (cached !== undefined) {
      return cached;
    }

    const value = await loader();

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- T is unconstrained, so TS treats it as never including null/undefined here; callers such as NotesService instantiate T as e.g. `NoteDetail | null`, where this check is exactly what prevents caching a not-found result.
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttlSeconds, codec.serialize);
    }

    return value;
  }

  /**
   * Checks connectivity to Redis.
   *
   * @returns The client's `PING` response.
   */
  public async ping(): Promise<string> {
    return this.redis.ping();
  }
}
