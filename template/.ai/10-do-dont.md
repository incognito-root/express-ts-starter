# What To Do and What Not To Do — {{PROJECT_NAME}}

This is the quick-reference checklist. For the reasoning behind each rule, see the relevant `.ai/` detail file.

---

## Architecture

### ❌ NEVER

- Import `prismaClient` (or anything from `generated/prisma`) outside `src/repositories/**`
- Write Prisma queries in services, controllers, or middleware
- Call `res.json()`, `res.send()`, or `res.status()` in a service
- Skip the repository layer and access the database directly from a service
- Add a new endpoint without wiring it through a route file
- Put business logic in a controller

### ✅ ALWAYS

- Follow Controller → Service → Repository → Prisma strictly
- Keep controllers thin: parse input → call one service method → call `sendSuccess`
- Keep services focused on business logic; let repositories handle all Prisma syntax
- Each repository method accepts an optional `tx?: PrismaTransactionClient` parameter

---

## Error Handling

### ❌ NEVER

- `throw new Error("...")` — always use typed error classes from `src/errors/`
- `catch (e) {}` — never silently swallow errors
- Return `{ success: false, error: "..." }` with a `200` status code
- Check error types by comparing `.message` strings
- Expose stack traces in production API responses
- Re-throw a different error type that loses the original context

### ✅ ALWAYS

- Use the right error class for the right situation (see `.ai/06-errors.md`)
- Use error message constants from `src/constants/errorMessages.ts`
- Let the global error handler in `ErrorHandler.ts` format and send all error responses
- At a minimum, log errors before re-throwing them in services
- Use `instanceof` checks when catching and examining error types

---

## Logging

### ❌ NEVER

- `console.log(...)`, `console.error(...)`, `console.warn(...)` in application code
- Log passwords, password hashes, access tokens, refresh tokens, or any secret
- Log full request bodies that may contain user PII without sanitizing first
- Log stack traces directly to the access log

### ✅ ALWAYS

- `import logger from "../utils/logger"` — use Winston exclusively
- Use structured logging: `logger.info("message", { key: value })`
- Log meaningful context: request ID, user ID, resource ID — not raw payloads
- Use the correct log level: `error` for exceptions, `warn` for recoverable issues, `info` for lifecycle, `debug` for detailed traces

---

## Security

### ❌ NEVER

- Disable CSRF protection on state-changing routes for any reason
- Hardcode secrets, API keys, or passwords in source code
- Use `*` as the CORS `origin` setting in production
- Skip input validation on any route, including "admin" or "internal" ones
- Skip rate limiting on authentication endpoints
- Store JWTs in `localStorage` or `sessionStorage`
- Suggest to callers that they should use `Authorization: Bearer` with these tokens
- Put tokens in response bodies for clients to store
- Return `500` errors that expose internal implementation details

### ✅ ALWAYS

- Validate all request inputs via Zod schemas + `validateBody` middleware
- Use `src/config/cookies.ts` for all cookie option presets
- Apply CSRF middleware to all POST, PUT, PATCH, DELETE routes
- Apply rate limiting to all auth endpoints
- Rotate refresh tokens on every `/auth/refresh` call
- Blacklist access token JTI on logout
- Check blacklist on every authenticated request

---

## TypeScript

### ❌ NEVER

- Use `any` type — use `unknown` with type guards or define proper interfaces
- `// @ts-ignore` — fix the actual type issue
- Use `as SomeType` for values coming from external sources (user input, API responses) — validate with Zod first
- Create duplicate type definitions — use the barrel in `src/types/`

### ✅ ALWAYS

- Define DTOs in `src/types/repository/<domain>.ts` or `src/types/api/` and export from `src/types/index.ts`
- Use `interface` for data shapes, `type` for unions/mapped types
- Prefix intentionally unused parameters with `_` to satisfy ESLint
- Add explicit return types on repository and service public methods

---

## Testing

### ❌ NEVER

- Mock the PostgreSQL database in integration tests (use the real Docker instance)
- Skip cleanup between integration tests — stale data causes flaky tests
- Test Express routing mechanics or third-party library behaviour
- Let integration tests hold a real Redis or DB connection open after the suite

### ✅ ALWAYS

- Use `tests/mocks/prisma.ts` as the Prisma stub in unit tests
- Use `vi.clearAllMocks()` in a `beforeEach` for unit tests
- Clean the integration test database in `beforeEach` or `afterEach`
- Write unit tests for all service business logic
- Write integration tests for all API endpoints
- Name test files to mirror the source structure

---

## Database

### ❌ NEVER

- Use `prisma db push --force-reset` outside of local development
- Use offset-based pagination (`skip` + `take` with a page number) for production list endpoints
- Import `prismaClient` outside `src/repositories/`
- Fetch fields you don't need — always `select` the specific fields required

### ✅ ALWAYS

- Use `npx prisma migrate dev --name <description>` for schema changes in development
- Use cursor-based pagination via `CursorPaginationHelper`
- Use `withTransaction()` for any multi-write operation that must be atomic
- Pass `tx?` as an optional parameter on every repository method
- Use `deleteMany` and check the returned count instead of `delete` when you need to detect "already gone"
- Add `select: { ... }` to exclude sensitive fields like `passwordHash` from query results

---

## Code Quality

### ❌ NEVER

- Add `dependencies` or `devDependencies` without checking for existing solutions in the codebase
- Add speculative abstractions or utilities for hypothetical future use
- Add error handling for impossible scenarios
- Copy-paste code from services/controllers — extract to a shared utility if used 3+ times
- Add comments that restate what the code does

### ✅ ALWAYS

- Run `npm run lint` and `npm run typecheck` before considering a change complete
- Follow the import group ordering enforced by ESLint (Node built-ins → external → internal → relative)
- Keep error message strings in `src/constants/errorMessages.ts`
- Add integration tests when adding a new API endpoint
- Update `src/types/index.ts` barrel when adding new types
