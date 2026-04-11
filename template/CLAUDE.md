# Claude Code Instructions — {{PROJECT_NAME}}

This project was scaffolded from `create-express-ts-starter`. It is a production-ready Express + TypeScript backend with a strict layered architecture, cookie-based JWT auth, Prisma 7 on PostgreSQL, Redis for queuing/rate-limiting/token-blacklisting, and Vitest for testing.

Read this file for the rules that matter most. Detailed references are in `.ai/`.

---

## Architecture: The 4-Layer Pattern

**Enforced by ESLint `no-restricted-imports`. Breaking this rule is a build error.**

```
HTTP Request
     │
     ▼
Route          (src/routes/)          ← URL + middleware wiring only
     │
     ▼
Controller     (src/controllers/)     ← HTTP in/out only; no business logic
     │
     ▼
Service        (src/services/)        ← ALL business logic lives here
     │
     ▼
Repository     (src/repositories/)   ← THE ONLY layer that touches Prisma
     │
     ▼
Prisma         (generated/prisma/)   ← Never import directly outside repositories
```

Full detail: `.ai/01-architecture.md`

---

## Critical Rules

### 1. Prisma stays in repositories
`src/utils/prismaClient.ts` may only be imported inside `src/repositories/**`.
If you need data in a service, inject the repository — never the Prisma client.

### 2. Never use `console.log`
All logging goes through Winston: `import logger from "../utils/logger"`.
Use structured logging: `logger.info("message", { key: value })`.
Never log passwords, tokens, or PII.

### 3. Always use typed error classes
Never `throw new Error("...")`. Use the classes from `src/errors/`:

| Situation | Class |
|---|---|
| Malformed input | `BadRequestError` |
| Zod validation failure | `UnprocessableEntityError` |
| Missing/invalid token | `UnauthorizedError` |
| Insufficient permissions | `ForbiddenError` |
| Resource not found | `NotFoundError` |
| Duplicate resource | `ConflictError` |
| Rate limit exceeded | `TooManyRequestsError` |
| Unexpected server fault | `InternalServerError` |

### 4. Always validate request bodies with Zod
Every mutating route uses the `validateBody` middleware. Schemas live in `src/validations/`.
Never trust `req.body` fields without prior Zod validation.

### 5. Always use async/await
No callbacks. No `.then()/.catch()` chains. No unhandled floating promises.
ESLint `@typescript-eslint/no-floating-promises` is set to error.

### 6. Never use `any`
Use `unknown` with type guards, or define proper interfaces. Never `// @ts-ignore`.

### 7. Cookies are the only token transport
Access and refresh JWTs travel as `httpOnly` cookies exclusively.
Never put tokens in response bodies or suggest `localStorage` to callers.

### 8. Single source for cookie config
All `Set-Cookie` options come from `src/config/cookies.ts`. Never hardcode `sameSite`, `secure`, `httpOnly` inline — import the shared config objects.

---

## Project Structure

```
src/
├── app.ts              # Server entry: dotenv → validateEnv → tracing → listen
├── createApp.ts        # Express factory (used by app.ts AND supertest in tests)
├── config/
│   ├── env.ts          # Zod-validated env schema — fails fast on startup
│   ├── cookies.ts      # Shared cookie option presets (auth + CSRF)
│   └── swagger.ts      # OpenAPI/Swagger setup
├── constants/
│   └── errorMessages.ts  # All user-facing error strings live here
├── controllers/        # HTTP handlers — thin; parse → call service → respond
├── errors/             # AppError hierarchy (BadRequestError, NotFoundError, etc.)
├── middlewares/        # Auth, CSRF, RateLimiter, ErrorHandler, Idempotency, etc.
├── repositories/       # ONLY place Prisma is used; extend BaseRepository
├── routes/             # Wire URL paths + middleware chains
├── services/           # All business logic; call repositories, throw typed errors
├── types/              # Barrel re-exports; domain-grouped sub-directories
├── utils/
│   ├── logger.ts         # Winston logger — always use this
│   ├── prismaClient.ts   # Prisma singleton — import ONLY in repositories
│   ├── redis/            # redisClient, redisRateLimiter, tokenBlacklist, redisOtpManager
│   ├── emails/           # emailService, templates, nodemailerProvider
│   ├── http/response.ts  # sendSuccess / sendError response helpers
│   └── pagination.ts     # CursorPaginationHelper
└── validations/        # Zod schemas for all request bodies

prisma/
├── schema.prisma       # Source of truth — 4 base models: User, Token, Organisation, OrganizationMember
└── seed.ts

tests/
├── mocks/prisma.ts     # Prisma stub for unit tests — import this, not the real client
├── unit/               # Mock all external deps; fast
└── integration/        # Real PostgreSQL + Redis via docker-compose.test.yml
```

---

## Quick Reference

| Topic | File |
|---|---|
| 4-layer architecture, middleware stack, request flow | `.ai/01-architecture.md` |
| File naming, TypeScript conventions, import order | `.ai/02-conventions.md` |
| ESLint rules, logging, async patterns | `.ai/03-code-style.md` |
| Unit vs integration tests, mocking, test commands | `.ai/04-testing.md` |
| JWT auth flow, CSRF, rate limiting, token blacklist | `.ai/05-auth-security.md` |
| AppError hierarchy, where to throw, error handler | `.ai/06-errors.md` |
| Repository pattern, BaseRepository, transactions | `.ai/07-database.md` |
| Redis failure modes, BullMQ queues, key naming | `.ai/08-redis-queues.md` |
| REST conventions, validation, versioning, pagination | `.ai/09-api-design.md` |
| ❌ NEVER / ✅ ALWAYS checklist | `.ai/10-do-dont.md` |

---

## How to Add a New Domain Feature

See `docs/EXTENDING.md` for the step-by-step walkthrough covering Prisma models, repository types, BaseRepository subclass, service, controller, route registration, and error messages.

---

## Key Infrastructure Behaviour to Know

| Component | Failure behaviour |
|---|---|
| Rate limiter (Redis) | **Fails closed** → throws `InternalServerError` |
| Token blacklist (Redis) | **Fails open** → allows request (bounded by JWT TTL) |
| Email queue (BullMQ) | Retries 3× with backoff; dead-letters on final failure |
| PostgreSQL | All repositories throw `InternalServerError` |
| Missing env vars | `validateEnv()` exits the process at startup with a descriptive message |
