# Testing — {{PROJECT_NAME}}

## Test Architecture

Tests are split into two separate Vitest projects configured in `vitest.config.ts`:

| Project | Location | Infrastructure | Speed |
|---|---|---|---|
| `unit` | `tests/unit/` | All external deps mocked | Fast (< 5 seconds) |
| `integration` | `tests/integration/` | Real PostgreSQL + Redis via Docker | Slower (2–3 minutes incl. Docker) |

## Commands

```bash
# Unit tests only
npm test

# Integration tests (starts Docker, runs suite, tears down)
./run-tests.sh

# Watch mode (unit)
npm run test:watch

# Specific test file
npx vitest run tests/unit/services/authService.test.ts
```

Integration tests require Docker. The `run-tests.sh` script handles `docker-compose.test.yml` lifecycle automatically.

---

## Unit Tests (`tests/unit/`)

### What to mock

Everything external to the unit under test:

| External dependency | How to mock |
|---|---|
| Prisma client | `tests/mocks/prisma.ts` — a pre-built `vi.mock` stub |
| Redis client | `vi.mock("../utils/redis/redisClient")` |
| BullMQ queue | `vi.mock("../queues/emailQueue")` |
| Winston logger | `vi.mock("../utils/logger", () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))` |
| External HTTP | `vi.mock` or `vi.spyOn(globalThis, "fetch")` |

### Using the Prisma stub

`tests/mocks/prisma.ts` exports a deeply-mocked Prisma client. Every model method (`findUnique`, `create`, `update`, `delete`, etc.) is a `vi.fn()` that returns `undefined` by default.

```typescript
import { prismaMock } from "../../mocks/prisma";

// Set up return values
prismaMock.user.findUnique.mockResolvedValue({
  id: "usr_123",
  email: "test@example.com",
  role: "member",
  // ...other fields
});

// Assert calls
expect(prismaMock.user.create).toHaveBeenCalledWith({
  data: expect.objectContaining({ email: "test@example.com" }),
});
```

### Service unit test structure

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "../../../src/services/userService";
import { prismaMock } from "../../mocks/prisma";
import { NotFoundError } from "../../../src/errors";

vi.mock("../../../src/utils/prismaClient", () => ({ default: prismaMock }));

describe("UserService", () => {
  let userService: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    userService = new UserService();
  });

  it("throws NotFoundError when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(userService.findById("nonexistent")).rejects.toThrow(NotFoundError);
  });
});
```

### What must have unit tests

- All service-layer business logic (every public method)
- All middleware (Auth, RateLimiter, Idempotency, CSRF, ErrorHandler)
- All utility functions with logic (pagination cursor encode/decode, retry backoff, sanitize)

---

## Integration Tests (`tests/integration/`)

### Infrastructure

`docker-compose.test.yml` spins up:
- **PostgreSQL** on port `5433` (avoids conflicts with local Postgres on 5432)
- **Redis** on port `6380` (avoids conflicts with local Redis on 6379)

`.env.test` provides the test database URL and Redis URL.

BullMQ email queue is **stubbed** in integration tests via `tests/integration/mocks/emailQueue.ts`. This stub replaces the queue's `addEmailJob` function with a spy — email jobs are captured without actually being processed.

### Getting the Express app

Use the `createApp` factory. Never import `app.ts` in tests.

```typescript
import supertest from "supertest";
import { createApp } from "../../src/createApp";

const app = createApp();
const request = supertest(app);
```

A shared test app instance is set up in `tests/integration/helpers/testApp.ts`.

### Database helpers

```typescript
import { cleanDatabase } from "../helpers/db";
import { seedTestUser } from "../helpers/db";

beforeEach(async () => {
  await cleanDatabase();         // wipes all tables in test DB
  await seedTestUser();          // insert known fixture
});
```

### Auth helpers

```typescript
import { loginAs } from "../helpers/auth";

const { accessCookie, csrfToken } = await loginAs(request, {
  email: "test@example.com",
  password: "Password123!",
});
```

### CSRF helpers

```typescript
import { getCsrfToken } from "../helpers/csrf";

const csrfToken = await getCsrfToken(request);
```

### Integration test structure

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { globalSetup, globalTeardown } from "./globalSetup";

describe("Auth: login flow", () => {
  beforeAll(async () => {
    await globalSetup();
  });

  afterAll(async () => {
    await globalTeardown();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it("returns 200 and sets auth cookies on valid credentials", async () => {
    await seedTestUser();
    const res = await request.post("/v1/auth/login").send({
      email: "test@example.com",
      password: "Password123!",
    });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeDefined();
  });
});
```

### What must have integration tests

- All authentication flows (login, logout, refresh, token rotation)
- All endpoints that mutate data (POST, PUT, PATCH, DELETE)
- Rate limiting behaviour
- CSRF protection
- Token blacklisting after logout

---

## Test File Location Convention

Mirror the source structure:

| Source file | Test file |
|---|---|
| `src/services/authService.ts` | `tests/unit/services/authService.test.ts` |
| `src/middlewares/Idempotency.ts` | `tests/unit/middlewares/Idempotency.test.ts` |
| `src/utils/pagination.ts` | `tests/unit/utils/pagination.test.ts` |
| Auth login flow | `tests/integration/auth/login-flow.test.ts` |
| CSRF protection | `tests/integration/auth/csrf-protection.test.ts` |

---

## What NOT to Test

- Express routing mechanics (framework internals)
- Third-party library return values
- TypeScript type compilation
- Prisma query syntax (trust Prisma's own tests)

---

## Vitest Config Notes

- `vitest.config.ts` uses the `projects` array pattern with two project entries (`unit` + `integration`)
- The `integration` project uses a separate environment config that aliases the Prisma generated client
- Alias `.*generated\/prisma.*` → `generated/prisma/client.ts` is required for Vitest to resolve the custom Prisma output path
