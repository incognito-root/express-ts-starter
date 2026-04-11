# Auth & Security — {{PROJECT_NAME}}

## Authentication Architecture

This project uses a **dual-token JWT system** with tokens delivered exclusively as `httpOnly` cookies.

### Tokens

| Token | Cookie name | Lifetime | Storage |
|---|---|---|---|
| Access token | `accessToken` | 15 minutes | `httpOnly` cookie only |
| Refresh token | `refreshToken` | 7 days | `httpOnly` cookie + hashed in DB |

The access token contains: `{ sub: userId, email, role, jti: uuid, tokenType: "access" }`.
The refresh token contains: `{ sub: userId, jti: uuid, tokenType: "refresh" }`.

The `tokenType` field is **always present** and checked in auth middleware. A refresh token cannot be used as an access token and vice versa.

### Auth Flow

```
1. POST /v1/auth/login
   → validate credentials
   → lookup user, verify password hash
   → create refresh token record in DB (id, userId, hash, expiresAt)
   → sign access token (15 min)
   → sign refresh token (7 days)
   → Set-Cookie: accessToken + refreshToken (httpOnly, secure, sameSite=strict)
   → return 200 { user }

2. Authenticated request
   → Auth middleware reads accessToken cookie
   → Verify JWT signature + expiry
   → Check tokenType === "access"
   → Check JTI not in Redis blacklist
   → Attach req.user = { id, email, role }

3. POST /v1/auth/refresh (silent refresh)
   → Read refreshToken cookie
   → Verify JWT signature + expiry
   → Check tokenType === "refresh"
   → ATOMIC DB transaction:
     a. DELETE token by JTI (returns count)
     b. If count === 0: token already consumed → UnauthorizedError (rotation attack)
     c. CREATE new refresh token record
   → Sign new access token
   → Sign new refresh token
   → Set-Cookie with new tokens
   → Blacklist old access token JTI in Redis

4. POST /v1/auth/logout
   → Blacklist current access token JTI in Redis (remaining TTL as Redis TTL)
   → Delete refresh token from DB
   → Clear cookies (Set-Cookie with expired date)
```

---

## Cookie Configuration

**Single source of truth: `src/config/cookies.ts`**

Never hardcode cookie options inline. Always import from this file.

```typescript
import { authCookieOptions, csrfCookieOptions } from "../config/cookies";

// Auth cookies (access + refresh)
res.cookie("accessToken", token, authCookieOptions);

// CSRF token cookie
res.cookie("csrfToken", token, csrfCookieOptions);
```

Key differences:
- Auth cookies: `sameSite: "strict"` — maximum CSRF protection
- CSRF cookie: `sameSite: "lax"` — must be readable by frontend JavaScript to submit in headers

In production: `secure: true` (HTTPS only). In development: `secure: false` (env-controlled).

---

## CSRF Protection [feature: csrf]

Implementation: `src/middlewares/Csrf.ts` using the `csrf-csrf` package (double-submit cookie pattern).

**Apply the CSRF middleware to all state-changing routes** (POST, PUT, PATCH, DELETE):

```typescript
// In route file
router.post("/users", csrfMiddleware, validateBody(createUserSchema), userController.create);
```

**Routes exempt from CSRF:**
- GET, HEAD, OPTIONS (idempotent, no state change)
- `POST /v1/auth/refresh` — cookie-only request, `sameSite=strict` on auth cookies already prevents CSRF

The CSRF token is sent by the client in the `X-CSRF-Token` request header (exposed via CORS `exposedHeaders` config).

---

## Rate Limiting

Implementation: `src/utils/redis/redisRateLimiter.ts` + `src/middlewares/RateLimiter.ts`.

**Behavior when Redis is unavailable: FAILS CLOSED.** The middleware throws `InternalServerError` rather than allowing potentially unlimited requests. This is an intentional security decision.

Apply rate limiting to:
- `POST /v1/auth/login` — e.g. 5 attempts per 15 minutes per IP
- `POST /v1/auth/register` — e.g. 3 attempts per hour per IP
- `POST /v1/auth/forgot-password` — e.g. 3 attempts per hour
- Any endpoint where abuse or enumeration is a concern

```typescript
// In route file
const loginLimiter = createRateLimiter({ maxRequests: 5, windowMs: 15 * 60 * 1000 });
router.post("/auth/login", loginLimiter, validateBody(loginSchema), authController.login);
```

---

## Token Blacklist

Implementation: `src/utils/redis/tokenBlacklist.ts`.

Redis key format: `blacklist:jti:<uuid>`
Redis TTL: remaining time until the token's `exp` claim, so the key auto-expires.

**Behavior when Redis is unavailable: FAILS OPEN.** If Redis is down, blacklist checks are skipped and the request is allowed. This is an intentional trade-off: a downed Redis should not lock out all users. The risk is bounded by the access token's short TTL (15 minutes).

```typescript
// On logout — blacklist the access token
await blacklistToken(accessJti, accessTokenExpiresAt);

// On every authenticated request — check blacklist
const isBlacklisted = await isTokenBlacklisted(jti);
if (isBlacklisted) throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_REVOKED);
```

---

## Role-Based Access Control (RBAC)

The system supports two levels of roles:

**Global role** (on the `User` model):
- `admin` — full platform access
- `member` — standard user access

**Organisation role** (on the `OrganizationMember` model):
- `owner` — org-level admin
- `admin` — org management
- `member` — standard org member

Authorization checks belong in the **service layer**, not controllers.

```typescript
// In a service method
if (currentUser.role !== "admin" && resource.ownerId !== currentUser.id) {
  throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN);
}
```

For org-level checks, load the `OrganizationMember` record and check its `role`.

---

## Security Checklist

### Always do

- Validate all request inputs with Zod before processing
- Use `sanitizeJsonInput` (already applied globally) for XSS protection
- Use parameterized queries (Prisma handles this automatically)
- Set `trust proxy: 1` in Express for correct `req.ip` behind nginx
- Use `helmet()` with a Content Security Policy
- Apply `httpOnly`, `secure`, `sameSite` to all cookies
- Check token blacklist on every authenticated request
- Rotate refresh tokens on every use

### Never do

- Store tokens anywhere except `httpOnly` cookies
- Suggest `localStorage` or `sessionStorage` for tokens in any documentation or code
- Disable CSRF protection for convenience
- Use `*` as CORS `origin` in production (set explicit allowed origins in `env.ts`)
- Skip input validation on any route, even "internal" ones
- Skip rate limiting on auth endpoints
- Log password hashes, access tokens, or refresh tokens
- Return stack traces in API responses (`NODE_ENV !== "development"` in the error handler)
- Hardcode secrets — all secrets through `env.ts` via environment variables

---

## Dependency Security

The project uses `.trivyignore` to suppress known safe CVEs in the Docker image. Before adding a new `npm install`, check for known vulnerabilities with `npm audit`. Keep dependencies up to date.
