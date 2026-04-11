# Code Style — {{PROJECT_NAME}}

## ESLint Configuration Summary

The project uses `@typescript-eslint/recommended-requiring-type-checking` plus the `import` plugin. Key rules and what they mean for your code:

### Errors (build fails)

| Rule | What it catches |
|---|---|
| `no-restricted-imports` | `prismaClient` imported outside `src/repositories/` |
| `@typescript-eslint/no-floating-promises` | Unhandled promise return values |
| `@typescript-eslint/no-misused-promises` | Passing async functions to synchronous callbacks |
| `@typescript-eslint/no-explicit-any` | Use of `any` type |
| `no-unused-vars` | Variables/imports that are declared but never used (except `_`-prefixed) |
| `import/order` | Import groups out of order or missing blank lines between groups |

### Warnings (won't break build, but must be fixed before PR)

| Rule | Context |
|---|---|
| `@typescript-eslint/no-unsafe-*` | In `src/services/**`, `src/controllers/**`, `src/middlewares/**` |

### ESLint overrides by layer

```
src/repositories/**    → no-restricted-imports OFF; all unsafe rules OFF
src/controllers/**     → unsafe rules as WARN
src/middlewares/**     → unsafe rules as WARN
src/services/**        → all unsafe rules as WARN
prisma/**, scripts/**  → no-restricted-imports OFF
```

Run the linter: `npm run lint`

---

## Logging with Winston

**Never use `console.log`, `console.error`, or `console.warn` in application code.**

Import the logger:
```typescript
import logger from "../utils/logger";
```

Available log levels (in decreasing severity):
- `logger.error(message, meta?)` — caught exceptions, failed operations
- `logger.warn(message, meta?)` — recoverable issues, degraded state
- `logger.info(message, meta?)` — lifecycle events (startup, connections, key operations)
- `logger.debug(message, meta?)` — detailed tracing, only active in development

Always use **structured logging** — pass additional data as the second argument:
```typescript
// Correct
logger.info("User registered", { userId: user.id, email: user.email });
logger.error("Email delivery failed", { jobId, error: err.message });

// Wrong — unstructured string interpolation
logger.info(`User ${user.id} registered`);
logger.error(`Failed: ${err}`);
```

**Never log sensitive data:**
```typescript
// Wrong — logs password / token
logger.info("Auth attempt", { email, password, token });

// Correct — log only safe identifiers
logger.info("Auth attempt", { email });
```

Use `dataSanitizer.ts` to mask PII before logging request payloads.

---

## Error Throwing

See `.ai/06-errors.md` for the full hierarchy. Quick rules:

```typescript
// Wrong — plain Error
throw new Error("User not found");

// Correct — typed error from src/errors/
throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
```

**Never silently swallow errors:**
```typescript
// Wrong
try {
  await doSomething();
} catch (_e) {
  // silent swallow
}

// Correct — at minimum log and re-throw
try {
  await doSomething();
} catch (err) {
  logger.error("doSomething failed", { error: (err as Error).message });
  throw err;
}
```

**Where to catch vs re-throw:**
- **Repositories**: let Prisma errors propagate unchanged (error handler maps them)
- **Services**: catch only if you can meaningfully recover or re-map; otherwise re-throw
- **Controllers**: never catch — let errors reach the global `errorHandler` middleware

---

## Async / Await

Always `await` promises. Never return an unawaited promise from a function that is not itself async.

```typescript
// Wrong — floating promise, ESLint will catch this
userRepository.deleteById(id);

// Correct
await userRepository.deleteById(id);

// Wrong — .then() chain
doSomething().then((result) => sendSuccess(res, result));

// Correct
const result = await doSomething();
sendSuccess(res, result);
```

**Fire-and-forget pattern** (only use when truly intentional, always comment why):
```typescript
// Intentional fire-and-forget: audit log must not block response
void auditLogger.log(event);
```

**Express route handlers with async:** The project uses Express 5, which natively handles async route handler rejections. Do not wrap route handlers in manual try-catch unless you need specific error handling behaviour.

---

## TypeScript Patterns

**Avoid type assertions on external/user data:**
```typescript
// Wrong — no validation, assertion is unsafe
const body = req.body as CreateUserDTO;

// Correct — validate first via Zod middleware, then req.body is typed
// The validateBody middleware sets req.body to the Zod-parsed type
```

**Prefer narrowing over assertion:**
```typescript
// Wrong
const user = maybeUser as User;

// Correct
if (!maybeUser) throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
const user = maybeUser; // TypeScript now knows it's User
```

**Readonly arrays for static data:**
```typescript
const ALLOWED_ROLES = ["admin", "member"] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
```

---

## Prettier (enforced via ESLint)

Settings from `.prettierrc.json` in the project root:
- Double quotes
- Semicolons required
- 2-space indentation
- 100 character line width
- Trailing commas in multi-line structures
- Bracket spacing in objects

Run auto-format: `npm run format` (if configured) or via editor Prettier integration.

---

## Commit Message Convention

The project uses `commitlint` with conventional commits (`.commitlintrc.js`):

```
type(scope): description

Types: feat, fix, refactor, test, docs, chore, perf, ci, build
```

Examples:
```
feat(auth): add OTP-based email verification
fix(rate-limiter): handle Redis timeout correctly
refactor(user): extract emailService to standalone utility
test(auth): add integration tests for token rotation
```

Husky pre-commit runs `lint-staged` (lint + format on staged files).
Husky pre-push blocks direct pushes to `main`/`master`.
