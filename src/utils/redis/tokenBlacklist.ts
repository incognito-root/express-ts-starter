import logger from "../logger";
import RedisSingleton from "./redisClient";

const BLACKLIST_PREFIX = "blacklist:jti:";

export const blacklistToken = async (
  jti: string,
  expiresAt: Date
): Promise<void> => {
  const ttlSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
  if (ttlSeconds <= 0) return; // already expired — no need to blacklist

  try {
    const client = RedisSingleton.getClient();
    await RedisSingleton.connect();
    await client.setEx(`${BLACKLIST_PREFIX}${jti}`, ttlSeconds, "1");
  } catch (error) {
    // Best-effort: log but don't throw. A blacklist write failure shouldn't
    // break logout — the refresh token is still revoked from the DB.
    logger.error("Failed to write token to blacklist", { jti, error });
  }
};

export const isTokenBlacklisted = async (jti: string): Promise<boolean> => {
  try {
    const client = RedisSingleton.getClient();
    await RedisSingleton.connect();
    const result = await client.get(`${BLACKLIST_PREFIX}${jti}`);
    return result !== null;
  } catch (error) {
    // Fail open: if Redis is unavailable, allow the request through.
    // Access tokens are short-lived (default 1h), so the exposure window is
    // bounded. Failing closed here would break all auth during Redis downtime.
    logger.warn("Token blacklist check unavailable, failing open", {
      jti,
      error,
    });
    return false;
  }
};
