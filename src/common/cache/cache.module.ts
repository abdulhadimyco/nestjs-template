import type { OnModuleDestroy } from "@nestjs/common";
import { Global, Inject, Module } from "@nestjs/common";
import type { Redis } from "ioredis";

import { REDIS_CLIENT } from "@/common/cache/cache.constants";
import { CacheService } from "@/common/cache/cache.service";
import { redisProvider } from "@/common/cache/redis.provider";

/**
 * Global module providing {@link CacheService} and the shared
 * {@link REDIS_CLIENT}. Quits the Redis connection on shutdown.
 */
@Global()
@Module({
  providers: [redisProvider, CacheService],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule implements OnModuleDestroy {
  /**
   * Creates the cache module.
   *
   * @param redis - The shared `ioredis` client.
   */
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Gracefully closes the Redis connection when the app shuts down.
   *
   * @returns A promise that resolves once the connection is closed.
   */
  public async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
