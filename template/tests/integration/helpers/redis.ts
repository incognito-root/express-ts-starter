import RedisSingleton from "../../../src/utils/redis/redisClient";

/**
 * Flush the entire test Redis database.
 */
export async function flushRedis() {
  const client = RedisSingleton.getClient();
  await client.flushDb();
}

/**
 * Delete only rate-limit keys. Useful when you want to reset rate limits
 * without wiping token blacklist entries.
 */
export async function resetRateLimits() {
  const client = RedisSingleton.getClient();
  // SCAN for ratelimit:* keys and delete them
  for await (const keys of client.scanIterator({ MATCH: "ratelimit:*" })) {
    if (keys.length > 0) {
      await client.del(keys);
    }
  }
}
