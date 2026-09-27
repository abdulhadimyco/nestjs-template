import type { Provider } from "@nestjs/common";
import { Redis } from "ioredis";

import { AppConfigService } from "@/config/app-config.service";
import { REDIS_CLIENT } from "@/common/cache/cache.constants";

const CLUSTER_SCHEME_PREFIX = "redis+cluster://";
const DEFAULT_REDIS_PORT = 6379;

/**
 * Parses a `redis+cluster://host1:port1,host2:port2` URL into cluster nodes.
 *
 * @param url - The cluster connection string.
 * @returns The list of `{ host, port }` nodes to connect to.
 */
function parseClusterNodes(url: string): { host: string; port: number }[] {
  const hostsPart = url.slice(CLUSTER_SCHEME_PREFIX.length);

  return hostsPart.split(",").map(hostAndPort => {
    const [host, port] = hostAndPort.split(":", 2);
    return {
      host: host ?? "localhost",
      port: Number(port ?? DEFAULT_REDIS_PORT),
    };
  });
}

/**
 * Creates an `ioredis` client (or cluster client) from the configured Redis
 * URL. A `redis+cluster://` scheme selects `Redis.Cluster`; anything else is
 * passed straight to the standard client.
 *
 * @param redisUrl - The configured Redis connection string.
 * @returns A connected-on-demand `ioredis` client.
 */
function createRedisClient(redisUrl: string): Redis {
  if (redisUrl.startsWith(CLUSTER_SCHEME_PREFIX)) {
    return new Redis.Cluster(parseClusterNodes(redisUrl), {
      lazyConnect: true,
      redisOptions: { maxRetriesPerRequest: 3, enableReadyCheck: true },
    }) as unknown as Redis;
  }

  return new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
}

/** Nest provider wiring up the shared {@link REDIS_CLIENT}. */
export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (config: AppConfigService): Redis =>
    createRedisClient(config.redisUrl),
  inject: [AppConfigService],
};
