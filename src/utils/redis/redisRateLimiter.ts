import { InternalServerError } from "../../errors/InternalServerError";
import { RateLimitError } from "../../errors/RateLimitError";
import logger from "../logger";

import RedisSingleton from "./redisClient";

export interface RateLimitOptions {
  key: string;
  pointsToConsume?: number;
  limit: number;
  duration: number;
  blockDuration?: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: Date;
  limit: number;
  retryAfter?: number;
}

export class RedisRateLimiter {
  private client: ReturnType<typeof RedisSingleton.getClient>;

  constructor() {
    this.client = RedisSingleton.getClient();
  }

  async consume(options: RateLimitOptions): Promise<RateLimitResult> {
    const {
      key,
      limit,
      duration,
      pointsToConsume = 1,
      blockDuration,
    } = options;
    const bucketKey = `ratelimit:${key}`;
    const blockKey = `ratelimit:blocked:${key}`;

    try {
      await RedisSingleton.connect();

      const isBlocked = await this.client.get(blockKey);
      if (isBlocked) {
        const ttl = await this.client.ttl(blockKey);
        throw new RateLimitError(
          "Rate limit exceeded, please try again later",
          {
            ttl,
            limit,
            retryAfter: ttl,
          }
        );
      }

      const now = Math.floor(Date.now() / 1000);
      const batch = this.client.multi();

      batch.hSetNX(bucketKey, "tokens", limit.toString());
      batch.hSetNX(bucketKey, "last", now.toString());
      batch.hGetAll(bucketKey);

      const results = await batch.exec();
      const bucketData = results[2] as unknown as Record<string, string>;

      if (!bucketData || !bucketData.tokens || !bucketData.last) {
        logger.warn("Redis returned incomplete bucket data", {
          key,
          bucketData,
        });

        await this.client.hSet(bucketKey, {
          tokens: limit.toString(),
          last: now.toString(),
        });

        await this.client.expire(bucketKey, duration * 2);

        return {
          success: true,
          remaining: limit - pointsToConsume,
          limit,
          resetTime: new Date((now + duration) * 1000),
        };
      }

      let tokens = parseInt(bucketData.tokens, 10);
      let lastRefill = parseInt(bucketData.last, 10);

      if (isNaN(tokens) || isNaN(lastRefill)) {
        logger.warn("Invalid token bucket data", { key, tokens, lastRefill });
        tokens = limit;
        lastRefill = now;

        await this.client.hSet(bucketKey, {
          tokens: tokens.toString(),
          last: lastRefill.toString(),
        });
      }

      const timePassed = Math.max(0, now - lastRefill);
      const refillAmount = Math.floor(timePassed * (limit / duration));

      if (refillAmount > 0) {
        tokens = Math.min(limit, tokens + refillAmount);
        lastRefill = now;
      }

      let retryAfter = 0;
      let success = true;

      if (tokens < pointsToConsume) {
        retryAfter = Math.ceil(((pointsToConsume - tokens) * duration) / limit);
        success = false;

        if (blockDuration) {
          await this.client.setEx(blockKey, blockDuration, "1");
        }

        throw new RateLimitError("Rate limit exceeded", {
          ttl: duration,
          limit,
          retryAfter,
        });
      }

      tokens -= pointsToConsume;
      await this.client.hSet(bucketKey, {
        tokens: tokens.toString(),
        last: lastRefill.toString(),
      });

      await this.client.expire(bucketKey, duration * 2);

      const resetTime = new Date((lastRefill + duration) * 1000);

      return {
        success,
        remaining: tokens,
        limit,
        resetTime,
        retryAfter: success ? 0 : retryAfter,
      };
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }

      logger.error("Rate limiting error", {
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
        key,
      });

      // Fail closed: deny the request when Redis is unavailable.
      // Failing open would allow unlimited auth attempts during a Redis outage.
      throw new InternalServerError("Rate limiter temporarily unavailable");
    }
  }

  async reset(key: string): Promise<void> {
    try {
      const bucketKey = `ratelimit:${key}`;
      const blockKey = `ratelimit:blocked:${key}`;

      await this.client.del(bucketKey);
      await this.client.del(blockKey);

      logger.debug(`Rate limit counters reset for key: ${key}`);
    } catch (error) {
      logger.error("Failed to reset rate limit", {
        key,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
      });
    }
  }

  async getStatus(
    key: string,
    limit: number,
    duration: number
  ): Promise<RateLimitResult | null> {
    try {
      await RedisSingleton.connect();
      const bucketKey = `ratelimit:${key}`;
      const blockKey = `ratelimit:blocked:${key}`;

      const isBlocked = await this.client.exists(blockKey);
      if (isBlocked) {
        const ttl = await this.client.ttl(blockKey);
        return {
          success: false,
          remaining: 0,
          limit,
          resetTime: new Date(Date.now() + ttl * 1000),
          retryAfter: ttl,
        };
      }

      const bucketData = await this.client.hGetAll(bucketKey);
      if (!bucketData || !bucketData.tokens || !bucketData.last) {
        return {
          success: true,
          remaining: limit,
          limit,
          resetTime: new Date(Date.now() + duration * 1000),
        };
      }

      const now = Math.floor(Date.now() / 1000);
      let tokens = parseInt(bucketData.tokens, 10);
      const lastRefill = parseInt(bucketData.last, 10);

      if (isNaN(tokens) || isNaN(lastRefill)) {
        return {
          success: true,
          remaining: limit,
          limit,
          resetTime: new Date(Date.now() + duration * 1000),
        };
      }

      const timePassed = Math.max(0, now - lastRefill);
      const refillAmount = Math.floor(timePassed * (limit / duration));

      if (refillAmount > 0) {
        tokens = Math.min(limit, tokens + refillAmount);
      }

      const resetTime = new Date((lastRefill + duration) * 1000);

      return {
        success: tokens > 0,
        remaining: tokens,
        limit,
        resetTime,
        retryAfter: tokens > 0 ? 0 : Math.ceil((1 * duration) / limit),
      };
    } catch (error) {
      logger.error("Failed to get rate limit status", {
        key,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
      });
      return null;
    }
  }
}

export const rateLimiter = new RedisRateLimiter();
