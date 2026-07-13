import Redis from "ioredis";
import { logger } from "@/lib/logger";

const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined;
  memoryRateLimit: Map<string, { count: number; resetAt: number }> | undefined;
};

function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL || undefined;
}

/**
 * Lazy Redis client. Returns null when REDIS_URL is unset so local
 * development and CI work without Redis.
 */
export function getRedis(): Redis | null {
  if (globalForRedis.redis !== undefined) {
    return globalForRedis.redis;
  }

  const url = getRedisUrl();
  if (!url) {
    globalForRedis.redis = null;
    return null;
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    client.on("error", (err: Error) => {
      logger.warn("redis_error", { error: err.message });
    });
    globalForRedis.redis = client;
    return client;
  } catch (err) {
    logger.warn("redis_init_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    globalForRedis.redis = null;
    return null;
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

function memoryBucket(): Map<string, { count: number; resetAt: number }> {
  if (!globalForRedis.memoryRateLimit) {
    globalForRedis.memoryRateLimit = new Map();
  }
  return globalForRedis.memoryRateLimit;
}

/**
 * Sliding fixed-window rate limiter. Uses Redis INCR when available,
 * otherwise an in-process Map (suitable for single-instance / dev).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;
  const redis = getRedis();

  if (redis) {
    try {
      if (redis.status !== "ready") {
        await redis.connect().catch(() => undefined);
      }
      const redisKey = `rl:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, windowSeconds);
      }
      const ttl = await redis.pttl(redisKey);
      const effectiveReset = ttl > 0 ? now + ttl : resetAt;
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt: effectiveReset,
        limit,
      };
    } catch (err) {
      logger.warn("rate_limit_redis_fallback", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const buckets = memoryBucket();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, limit };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    limit,
  };
}
