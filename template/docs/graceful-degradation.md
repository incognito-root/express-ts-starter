# Graceful Degradation

This document describes how the application behaves when individual infrastructure components become unavailable. It is intended for operators and developers who need to understand failure modes during outages or deployments.

---

## Redis Unavailable

Redis is used for: rate limiting, access token blacklisting, email job queuing (BullMQ), and OTP management. The behaviour of each feature when Redis is down is intentional and differs for security reasons.

| Feature | File | Fails | Behaviour |
|---|---|---|---|
| **Rate limiting** | `src/utils/redis/redisRateLimiter.ts` | **Closed** | Throws `InternalServerError` (HTTP 500). All rate-limited routes are blocked. This is intentional — failing open would allow unlimited auth brute-force during an outage. |
| **Access token blacklist** | `src/utils/redis/tokenBlacklist.ts` | **Open** | `isTokenBlacklisted` returns `false` — recently-logged-out access tokens remain valid until they expire naturally. Risk is bounded by the access token TTL (default `JWT_ACCESS_EXPIRY`, e.g., 15 min). Failing closed here would lock out all authenticated users. |
| **Email queue (BullMQ)** | `src/queues/emailQueue.ts` | **Error** | Any attempt to queue an email (verification, welcome, etc.) fails with `InternalServerError`. Registration and email-verification flows will return 500 until Redis is restored. Emails are not silently dropped — the caller receives the error. |
| **OTP management** | `src/utils/redis/redisOtpManager.ts` | **Error** | OTP generation and verification fail. Any feature gated behind OTP verification will be unavailable. |
| **WebSocket** | `src/websocket/index.ts` | **Unaffected** | The Socket.IO server uses an in-memory rate limiter; no Redis adapter is wired by default. WebSocket connections continue normally in single-node deployments. |

### Operator checklist when Redis goes down

1. **Expect elevated 500 rates** on auth routes (login, signup, token refresh) — all rate-limited requests are blocked.
2. **Access tokens issued before the outage remain valid** — no additional exposure, but blacklisted tokens (from recent logouts) will be temporarily accepted again.
3. **Email delivery stops** — registration and email-verification will error until Redis is restored. Users can retry after recovery.
4. **Monitor** `logs/app-*.log` for `"Rate limiter temporarily unavailable"` and `"Token blacklist check unavailable"` as leading indicators.

### To make email resilient to short Redis blips

If your use case cannot tolerate email queue failures during Redis restarts, consider:

- Wrapping `queueVerificationEmail` with the `withRetry` utility (`src/utils/retry.ts`) so transient connection errors are retried before surfacing as a 500.
- Adding a dead-letter queue or a database-backed fallback queue for critical emails.

---

## PostgreSQL Unavailable

All repository operations throw `InternalServerError` (via Prisma's connection error). No silent data loss. The circuit breaker in `src/utils/circuitBreaker.ts` can be wrapped around repository calls to fail fast after repeated failures rather than exhausting the connection pool.

---

## Email Provider (SMTP) Unavailable

BullMQ retries each email job up to 3 times with exponential backoff (base 2 s). If all retries fail, the job moves to the `failed` queue in Redis (visible via BullMQ dashboard or `bull-board`). No emails are silently lost as long as Redis is available.

---

## Environment Variables Not Set

`src/config/env.ts` validates all required env vars at startup via Zod. Any missing required variable causes the process to exit immediately with a descriptive error. The server never starts in a partially-configured state.
