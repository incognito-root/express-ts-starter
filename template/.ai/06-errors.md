# Error Handling — {{PROJECT_NAME}}

## AppError Hierarchy

All application errors extend `AppError`, which extends the native `Error` class. The global error handler (`src/middlewares/ErrorHandler.ts`) catches all thrown errors and formats them into consistent JSON responses.

```
Error (native)
└── AppError (src/errors/AppError.ts)
    ├── BadRequestError          400  — Malformed or invalid input
    ├── UnauthorizedError        401  — Missing, expired, or invalid credentials
    ├── ForbiddenError           403  — Authenticated but insufficient permissions
    ├── NotFoundError            404  — Requested resource does not exist
    ├── ConflictError            409  — Duplicate resource, state conflict
    ├── UnprocessableEntityError 422  — Semantically invalid input (Zod failures)
    ├── TooManyRequestsError     429  — Rate limit exceeded
    └── InternalServerError      500  — Unexpected server fault
```

### AppError interface

```typescript
class AppError extends Error {
  statusCode: number;    // HTTP status code
  message: string;       // User-facing message (no stack traces)
  code?: string;         // Optional machine-readable error code (e.g. "INVALID_CREDENTIALS")
  isOperational: boolean; // true = expected error, false = programmer mistake
}
```

---

## Where to Throw Each Error

### In repositories
Do **not** wrap in try-catch. Let Prisma errors propagate to the error handler.
The error handler maps Prisma's `P2002` (unique constraint) → `ConflictError`, `P2025` (not found) → `NotFoundError`.

```typescript
// Correct — no try-catch in repositories
async findByEmail(email: string, tx?: PrismaTransactionClient) {
  const client = tx ?? prisma;
  return client.user.findUnique({ where: { email } });
}
```

### In services
Throw errors when business rules are violated.

```typescript
// Resource lookup
const user = await this.userRepository.findById(id);
if (!user) throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);

// Authorization check
if (resource.ownerId !== currentUser.id && currentUser.role !== "admin") {
  throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN);
}

// Conflict check
const existing = await this.userRepository.findByEmail(email);
if (existing) throw new ConflictError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);

// Token already consumed (rotation attack detection)
const count = await this.tokenRepository.deleteById(tokenId);
if (count === 0) throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_ALREADY_USED);
```

### In controllers
Controllers are thin — they should rarely throw. Validation errors are handled by the `validateBody` middleware upstream. The only controller-level throws should be for HTTP-specific conditions.

```typescript
// Example: missing route param
const { id } = req.params;
if (!id) throw new BadRequestError(ERROR_MESSAGES.MISSING_ID);

// Then call service — service throws if anything goes wrong
const user = await this.userService.findById(id);
sendSuccess(res, user);
```

### In middleware
Throw directly. Middleware errors go to the global error handler.

```typescript
// Rate limiter
throw new TooManyRequestsError(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);

// Auth middleware
throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_INVALID);
```

---

## Global Error Handler (`src/middlewares/ErrorHandler.ts`)

The error handler is the last middleware registered in `createApp.ts`. It:

1. Checks `err instanceof AppError` → uses `err.statusCode` and `err.message` directly
2. Checks for Prisma known request errors:
   - `P2002` (unique constraint violation) → `409 ConflictError`
   - `P2025` (record not found) → `404 NotFoundError`
3. Falls back to `500 InternalServerError` for anything else
4. In development: includes `stack` in the response body
5. In production: never exposes stack traces
6. Always logs 5xx errors via `logger.error()`

Response format:
```json
{
  "success": false,
  "error": "User not found",
  "code": "USER_NOT_FOUND",
  "requestId": "req_abc123"
}
```

---

## Error Message Strings

**All user-facing error strings live in `src/constants/errorMessages.ts`.**
Never hardcode message text in services or controllers.

```typescript
// src/constants/errorMessages.ts
export const ERROR_MESSAGES = {
  USER_NOT_FOUND: "User not found",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists",
  INVALID_CREDENTIALS: "Invalid email or password",
  TOKEN_INVALID: "Authentication token is invalid or expired",
  TOKEN_REVOKED: "This token has been revoked",
  TOKEN_ALREADY_USED: "This token has already been used",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later.",
  FORBIDDEN: "You do not have permission to perform this action",
  // ...
} as const;
```

---

## DOs and DON'Ts for Error Handling

```typescript
// ❌ Wrong — plain Error
throw new Error("Something went wrong");

// ✅ Correct — typed error
throw new InternalServerError(ERROR_MESSAGES.INTERNAL_ERROR);

// ❌ Wrong — swallowing errors
try { await op(); } catch {}

// ✅ Correct — log and re-throw
try { await op(); } catch (err) {
  logger.error("Operation failed", { error: (err as Error).message });
  throw err;
}

// ❌ Wrong — returning error in success response
res.status(200).json({ success: false, error: "Not found" });

// ✅ Correct — throw and let errorHandler respond
throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);

// ❌ Wrong — checking error type with string comparison
if (err.message === "not found") { ... }

// ✅ Correct — instanceof check
if (err instanceof NotFoundError) { ... }
```
