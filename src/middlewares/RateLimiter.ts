import { Request, Response, NextFunction } from "express";

import { RateLimitError } from "../errors/RateLimitError";
import { RateLimitMiddlewareOptions } from "../types";
import { rateLimiter, RateLimitOptions } from "../utils/redis/redisRateLimiter";

export const createRateLimiter = (options: RateLimitMiddlewareOptions) => {
  const {
    limit,
    windowInSeconds,
    pointsToConsume = 1,
    keyGenerator = (req) => `${req.ip}:${req.path}`,
    blockDuration,
    standardHeaders = true,
    errorMessage = "Too many requests, please try again later.",
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);

      const rateLimitOptions: RateLimitOptions = {
        key,
        limit,
        duration: windowInSeconds,
        pointsToConsume,
        blockDuration,
      };

      const result = await rateLimiter.consume(rateLimitOptions);

      if (standardHeaders) {
        res.set("X-RateLimit-Limit", limit.toString());
        res.set("X-RateLimit-Remaining", result.remaining.toString());
        res.set(
          "X-RateLimit-Reset",
          Math.floor(result.resetTime.getTime() / 1000).toString()
        );
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        if (standardHeaders) {
          res.set("X-RateLimit-Limit", limit.toString());
          res.set("X-RateLimit-Remaining", "0");
          res.set(
            "X-RateLimit-Reset",
            Math.floor((Date.now() + error.ttl * 1000) / 1000).toString()
          );
          res.set("Retry-After", error.retryAfter.toString());
        }

        error.message = errorMessage;
        next(error);
      } else {
        next(error);
      }
    }
  };
};

export const standardRateLimiter = createRateLimiter({
  limit: 100,
  windowInSeconds: 60,
  standardHeaders: true,
});

export const strictRateLimiter = createRateLimiter({
  limit: 30,
  windowInSeconds: 60,
  standardHeaders: true,
});

export const authRateLimiter = createRateLimiter({
  limit: 5,
  windowInSeconds: 15 * 60,
  keyGenerator: (req) => `auth:${req.ip}`,
  blockDuration: 30 * 60,
  errorMessage: "Too many authentication attempts, please try again later.",
});

export const apiRateLimiter = createRateLimiter({
  limit: 1000,
  windowInSeconds: 60 * 60,
  keyGenerator: (req) => {
    const apiKey = req.headers["x-api-key"];
    const key = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    // Include IP so rotating the x-api-key header doesn't bypass the limit
    return `api:${req.ip ?? "unknown"}:${key || "anonymous"}`;
  },
});
