import { Request, Response, NextFunction } from "express";

import logger from "../utils/logger";
import RedisSingleton from "../utils/redis/redisClient";

const IDEMPOTENCY_PREFIX = "idempotency:";
/** Successful responses are cached for 24 hours. */
const IDEMPOTENCY_TTL_SEC = 86_400;
/**
 * Short lock TTL for in-flight requests. If the handler doesn't complete
 * within 60 s the lock auto-expires so clients can retry.
 */
const LOCK_TTL_SEC = 60;
const PROCESSING_SENTINEL = "PROCESSING";

interface CachedResponse {
  status: number;
  body: unknown;
}

/**
 * Opt-in idempotency middleware — apply per-route to any POST/PUT/PATCH that
 * must not execute twice (payments, registration, email sends, etc.).
 *
 * ## How to use
 * ```ts
 * router.post("/checkout", idempotency, checkoutController);
 * ```
 *
 * ## Client contract
 * The client must send a unique `Idempotency-Key` header (UUID v4) with each
 * request. On a replay, the server returns the original response with
 * `Idempotency-Replayed: true`.
 *
 * ## Failure mode
 * If Redis is unavailable the middleware fails **open** — the request proceeds
 * without idempotency protection. Log a warning to alert on-call.
 */
export const idempotency = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const key = req.headers["idempotency-key"];

  // No key supplied — pass through (caller did not opt in to idempotency).
  if (!key || typeof key !== "string") {
    next();
    return;
  }

  // Validate: must be a UUID v4.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key
    )
  ) {
    res.status(400).json({
      error: "Invalid Idempotency-Key. Must be a UUID v4.",
    });
    return;
  }

  void _handleIdempotency(key, req, res, next);
};

async function _handleIdempotency(
  key: string,
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;

  try {
    const client = RedisSingleton.getClient();
    await RedisSingleton.connect();

    // Atomic: set key → PROCESSING only if it does not already exist.
    const acquired = await client.set(redisKey, PROCESSING_SENTINEL, {
      NX: true,
      EX: LOCK_TTL_SEC,
    });

    if (!acquired) {
      // Key exists — either processing or already cached.
      const existing = await client.get(redisKey);

      if (existing === PROCESSING_SENTINEL) {
        // A concurrent request with the same key is still being handled.
        res.status(409).json({
          error:
            "A request with this Idempotency-Key is already being processed.",
        });
        return;
      }

      if (existing) {
        // Return the cached response from the previous successful request.
        const cached = JSON.parse(existing) as CachedResponse;
        res.setHeader("Idempotency-Replayed", "true");
        res.status(cached.status).json(cached.body);
        return;
      }
    }

    // We hold the lock — intercept the outgoing response to cache it.
    const originalJson = res.json.bind(res) as typeof res.json;

    res.json = function (body: unknown) {
      const statusCode = res.statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        // Cache the successful response and extend TTL to the full 24 hours.
        const payload = JSON.stringify({ status: statusCode, body });
        client
          .set(redisKey, payload, { EX: IDEMPOTENCY_TTL_SEC })
          .catch((err: unknown) => {
            logger.warn("Failed to cache idempotency response", { key, err });
          });
      } else {
        // On error, release the lock so the client can safely retry.
        client.del(redisKey).catch(() => {});
      }

      return originalJson(body);
    };

    next();
  } catch (err) {
    // Redis unavailable — fail open so the API remains functional.
    logger.warn("Idempotency middleware unavailable, proceeding without cache", {
      key,
      err,
    });
    next();
  }
}
