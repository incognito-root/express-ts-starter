# GitHub Copilot Instructions — {{PROJECT_NAME}}

Express + TypeScript backend scaffolded from `create-express-ts-starter`. Read these rules before suggesting code.

## Architecture: 4-Layer Pattern (ESLint-enforced)

```
Route → Controller → Service → Repository → Prisma
```

- **Controller** (`src/controllers/`): HTTP in/out only. Parse input, call one service method, return response. No business logic, no DB.
- **Service** (`src/services/`): All business logic. Call repositories. Throw typed errors.
- **Repository** (`src/repositories/`): **Only** place that imports `prismaClient`. Extend `BaseRepository`.
- **Route** (`src/routes/`): Wire URL + middleware to controller method.

## Non-Negotiable Rules

1. **Never import `prismaClient` outside `src/repositories/`** — ESLint error if you do.
2. **Never `console.log`** — use `import logger from "../utils/logger"` (Winston).
3. **Never `throw new Error(...)`** — use typed classes from `src/errors/` (`NotFoundError`, `UnauthorizedError`, `ConflictError`, `BadRequestError`, `UnprocessableEntityError`, `ForbiddenError`, `TooManyRequestsError`, `InternalServerError`).
4. **Never use `any`** — use `unknown` + type guards or proper interfaces.
5. **Always `async/await`** — no `.then()/.catch()` chains, no unhandled promises.
6. **Always validate request bodies** with Zod schemas from `src/validations/` via the `validateBody` middleware.
7. **JWTs travel as `httpOnly` cookies only** — never in response bodies or `Authorization` headers.
8. **All cookie options from `src/config/cookies.ts`** — never hardcode `sameSite`, `secure`, `httpOnly` inline.

## Patterns to Follow

### Throwing errors in services
```typescript
const user = await this.userRepository.findById(id);
if (!user) throw new NotFoundError("User not found");
```

### Repository methods (always accept optional `tx`)
```typescript
async findById(id: string, tx?: PrismaTransactionClient) {
  const client = tx ?? prisma;
  return client.user.findUnique({ where: { id } });
}
```

### Atomic multi-write operations
```typescript
await this.baseRepo.withTransaction(async (tx) => {
  await this.tokenRepo.deleteById(oldId, tx);
  await this.tokenRepo.create(newData, tx);
});
```

### HTTP responses
```typescript
// Success
return sendSuccess(res, data, "Created", 201);
// Error — never call sendError directly; throw instead
throw new ConflictError("Email already in use");
```

### Structured logging
```typescript
logger.info("User created", { userId: user.id });
logger.error("DB connection failed", { error: err.message });
// Never: logger.info({ password }) or logger.info({ token })
```

## File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Middleware | PascalCase | `Auth.ts`, `RateLimiter.ts` |
| Controller | camelCase + "Controller" | `authController.ts` |
| Service | camelCase + "Service" | `authService.ts` |
| Repository | PascalCase + "Repository" | `UserRepository.ts` |
| Utility | camelCase | `pagination.ts`, `logger.ts` |
| Validation | camelCase + "Validations" | `authValidations.ts` |

## Testing

- **Unit tests** (`tests/unit/`): Use `tests/mocks/prisma.ts` for Prisma. Mock Redis and email with `vi.mock`.
- **Integration tests** (`tests/integration/`): Real PostgreSQL (port 5433) + Redis (port 6380) via `docker-compose.test.yml`. Get the Express app via `import { createApp } from "../../src/createApp"`.
- Run unit tests: `npm test`
- Run integration tests: `./run-tests.sh` (starts Docker, runs suite, tears down)

## Key File Paths

| Purpose | Path |
|---|---|
| Env validation | `src/config/env.ts` |
| Cookie config | `src/config/cookies.ts` |
| Error classes | `src/errors/` |
| Error messages | `src/constants/errorMessages.ts` |
| Auth middleware | `src/middlewares/Auth.ts` |
| Rate limiter | `src/utils/redis/redisRateLimiter.ts` |
| Token blacklist | `src/utils/redis/tokenBlacklist.ts` |
| Prisma client | `src/utils/prismaClient.ts` (repositories only) |
| Response helpers | `src/utils/http/response.ts` |
| Cursor pagination | `src/utils/pagination.ts` |

## Infrastructure Failure Modes

| Component | Behaviour when down |
|---|---|
| Redis (rate limiter) | **Fails closed** → 500 |
| Redis (token blacklist) | **Fails open** → allows request |
| PostgreSQL | All repo operations throw `InternalServerError` |
| SMTP | BullMQ retries 3× with backoff, then dead-letters |
