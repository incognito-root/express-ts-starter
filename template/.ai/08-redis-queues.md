# Redis & Queues — {{PROJECT_NAME}}

## Redis Client

Singleton: `src/utils/redis/redisClient.ts`

Initialized in `src/app.ts` during startup. Connection is non-fatal — if Redis is unavailable at startup, the server still starts but Redis-dependent features degrade (see failure modes below).

The client is configured with connection retry logic. Import it in Redis utilities only (never in services or controllers directly).

---

## Failure Mode Reference

This is critical to understand. Different Redis-dependent components have **different** failure behaviours by design:

| Component | Failure Behaviour | Rationale |
|---|---|---|
| Rate limiter | **Fails CLOSED** → throws `InternalServerError` | Auth endpoints must not allow unlimited requests if Redis is down |
| Token blacklist | **Fails OPEN** → allows request | A downed Redis should not lock out all users; risk bounded by JWT TTL (15 min) |
| OTP manager | **Fails with error** → throws `InternalServerError` | OTP validation must be reliable |
| Email queue | **Fails with error** → throws, BullMQ retries | Queue errors are retried; DLQ captures persistent failures |
| WebSocket | **Unaffected** | Socket.IO uses in-memory adapter as fallback |

Do not change these failure behaviours without understanding the security implications.

---

## Rate Limiter

Implementation: `src/utils/redis/redisRateLimiter.ts`
Middleware factory: `src/middlewares/RateLimiter.ts`

Uses a sliding window algorithm backed by Redis sorted sets.

### Creating a rate limiter

```typescript
import { createRateLimiter } from "../middlewares/RateLimiter";

// Create a limiter for the login endpoint
const loginLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: "login",
});

// Apply to routes
router.post("/auth/login", loginLimiter, validateBody(loginSchema), authController.login);
```

The key is derived from `req.ip` + the keyPrefix. In production, `trust proxy: 1` ensures `req.ip` reflects the real client IP, not the load balancer.

**When Redis is unavailable:** throws `InternalServerError` immediately (fails closed). This is intentional — see failure modes table.

---

## Token Blacklist

Implementation: `src/utils/redis/tokenBlacklist.ts`

### Key format
```
blacklist:jti:<uuid>
```

### TTL
Set to the remaining time until the token's `exp` Unix timestamp. When the token would have expired naturally, the Redis key also expires — no manual cleanup needed.

### Usage

```typescript
import { blacklistToken, isTokenBlacklisted } from "../utils/redis/tokenBlacklist";

// On logout — call with the JTI and the token's expiry date
await blacklistToken(accessJti, new Date(decodedToken.exp * 1000));

// In Auth middleware — check every authenticated request
const blacklisted = await isTokenBlacklisted(jti);
if (blacklisted) throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_REVOKED);
```

**When Redis is unavailable:** logs a warning, returns `false` (not blacklisted). This is intentional — fails open. The maximum window for a revoked token to be useable is the access token's 15-minute TTL.

---

## OTP Manager

Implementation: `src/utils/redis/redisOtpManager.ts`

Used for email verification and password reset flows.

### Key format
```
otp:<purpose>:<userId>
```

Example: `otp:email-verification:usr_abc123`

### Operations
- **Store OTP**: saves the code with a TTL (typically 10–15 minutes)
- **Verify OTP**: checks the code and **atomically deletes** it on success (prevents replay)
- **Invalidate OTP**: delete before expiry (e.g. user requests a new code)

OTP endpoints should be rate-limited separately to prevent brute-force enumeration.

---

## BullMQ Email Queue [feature: bullmq]

Implementation: `src/queues/emailQueue.ts`

### Job types

| Job name | Purpose | Data |
|---|---|---|
| `email-verification` | Send email verification link | `{ userId, email, verificationToken }` |
| `password-reset` | Send password reset link | `{ userId, email, resetToken }` |

### Adding a job

```typescript
import { addEmailJob } from "../queues/emailQueue";

await addEmailJob("email-verification", {
  userId: user.id,
  email: user.email,
  verificationToken: token,
});
```

### Worker behaviour

The worker in `emailQueue.ts` processes jobs and calls `emailService.send()`.

Retry policy:
- Max attempts: **3**
- Backoff: **exponential** — 1s, 2s, 4s
- After final failure: job moves to the dead-letter queue (held in Redis until manually inspected or cleared)

### Testing

In integration tests, `addEmailJob` is stubbed via `tests/integration/mocks/emailQueue.ts` — jobs are captured in a spy array rather than processed. This prevents test suite from needing an SMTP connection.

```typescript
import { getQueuedEmails, clearQueuedEmails } from "../../mocks/emailQueue";

it("sends verification email on register", async () => {
  await register(userData);
  const emails = getQueuedEmails("email-verification");
  expect(emails).toHaveLength(1);
  expect(emails[0].data.email).toBe(userData.email);
});

afterEach(() => clearQueuedEmails());
```

---

## Redis Key Naming Convention

Always follow this convention when adding new Redis keys:

```
<category>:<subcategory>:<identifier>
```

| Pattern | Example | Owner |
|---|---|---|
| `blacklist:jti:<uuid>` | `blacklist:jti:a1b2c3d4-...` | tokenBlacklist.ts |
| `otp:<purpose>:<userId>` | `otp:password-reset:usr_123` | redisOtpManager.ts |
| `ratelimit:<endpoint>:<ip>` | `ratelimit:login:192.168.1.1` | redisRateLimiter.ts |
| `idempotency:<key>` | `idempotency:req_abc123` | Idempotency.ts |

Use short but descriptive category names. Always include an identifier so keys can be targeted for deletion without pattern scanning.
