# express-ts-starter

A production-ready Express + TypeScript backend starter template. Clone it, run the init script, and start building your domain logic immediately.

Built for SaaS backends - includes authentication, RBAC, multi-tenancy foundations, async email, real-time sockets, observability, and a full CI/CD pipeline. Everything you need to skip the boilerplate and ship faster.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 20, Express 5, TypeScript 5 |
| **Database** | PostgreSQL 16 + Prisma 7 (driver adapter) |
| **Cache / Queue** | Redis 7, BullMQ 5 |
| **Real-time** | Socket.IO 4 (Redis adapter for multi-instance) |
| **Auth** | JWT dual-token (httpOnly cookies), bcrypt, CSRF (csrf-csrf) |
| **Observability** | OpenTelemetry tracing, Prometheus metrics (prom-client) |
| **Email** | Nodemailer + Handlebars templates, async via BullMQ |
| **Validation** | Zod (env), express-validator (requests) |
| **Logging** | Winston + daily rotate, request ID correlation, OTEL trace injection |
| **Security** | Helmet, rate limiting (Redis-backed), XSS sanitization (DOMPurify) |
| **Testing** | Vitest 4, Supertest, k6 load testing |
| **CI/CD** | GitHub Actions (lint, typecheck, test, build, security scan, smoke test) |
| **Deployment** | Multi-stage Docker, PM2, dumb-init |
| **Media** | Cloudinary v2 (optional) |

---

## Features

### Authentication & Authorization
- Cookie-based JWT with `accessToken` + `refreshToken` (httpOnly, secure, SameSite)
- Silent token refresh - access tokens auto-renew using refresh tokens
- Refresh token rotation with atomic revocation (race-condition safe)
- Access token blacklist via Redis JTI (instant logout)
- Email verification flow with one-time tokens
- CSRF double-submit protection (csrf-csrf)
- `rememberMe` support (extended refresh token TTL)
- Multi-context RBAC: Platform-level + Organization-level roles

### Security
- Helmet with CSP, HSTS, and other security headers
- Redis-backed rate limiting (per-IP, per-route tiers) - fails closed
- XSS sanitization on all request bodies (DOMPurify)
- Password byte-length enforcement (bcrypt 72-byte limit)
- Input validation via express-validator with typed error responses
- JWT expiry durations validated at startup (`ms`-compatible strings)

### Architecture
- **Layered architecture**: Controller → Service → Repository → Prisma (enforced by ESLint `no-restricted-imports`)
- Typed request system (`TypedRequestWithUser`, `TypedRequestFull`, etc.)
- 10 typed error classes extending `AppError` with cause chaining and error IDs
- Circuit breaker for external service calls (`opossum`)
- Retry with exponential backoff + jitter (`withRetry<T>`)
- Request idempotency middleware (Redis-based, opt-in per route)
- Cursor-based pagination helper (opaque base64url cursors, N+1 detection)

### Observability
- OpenTelemetry SDK with OTLP HTTP exporter (conditional on `OTEL_EXPORTER_OTLP_ENDPOINT`)
- Prometheus metrics (`/metrics` endpoint, Bearer-gated)
- Request duration histogram + request counter (method/route/status)
- Winston structured logging with daily rotation (14-day retention)
- Request ID correlation across all log lines (`AsyncLocalStorage`)
- OTEL trace ID injection in log output
- Audit log for all auth events (90-day retention)

### API Design
- URL path versioning (`/v1/`) with RFC 8594 deprecation headers
- Version registry - deprecate versions with config-only changes
- Swagger/OpenAPI docs (development mode)
- Standardized error responses with error IDs

### Infrastructure
- Multi-stage Docker build with `dumb-init` + non-root user
- PM2 ecosystem config with memory limits
- Graceful shutdown (SIGINT/SIGTERM) with OTEL + Prisma + Redis cleanup
- Configurable connection pooling (`DB_POOL_SIZE`)
- Soft delete support (`deletedAt` on User + Organisation)
- Socket.IO with Redis adapter for horizontal scaling

### Developer Experience
- Interactive `init.js` script - replace placeholders, create `.env`, self-deletes
- Husky + lint-staged + commitlint (conventional commits)
- Path aliases (`@controllers/*`, `@services/*`, etc.)
- ESLint strict mode with `no-unsafe-*` as warnings
- Prettier formatting
- Extension guides (`docs/EXTENDING.md`)

---

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **PostgreSQL** >= 15
- **Redis** >= 7
- **npm** >= 9

### Setup

```bash
# 1. Clone the template (don't fork - start fresh)
git clone https://github.com/YOUR_USERNAME/express-ts-starter.git my-project
cd my-project
rm -rf .git && git init

# 2. Run the init script (replaces placeholders, creates .env)
node scripts/init.js

# 3. Install dependencies
npm install

# 4. Edit .env with your actual values (see Environment Variables below)

# 5. Generate Prisma client
npm run prisma:generate

# 6. Run database migration
npx prisma migrate dev --name init

# 7. Seed the database (creates default org + superadmin)
npm run prisma:seed

# 8. Start the development server
npm run dev
```

The server starts at `http://localhost:3001`.

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /ready` | Readiness check (DB + Redis) |
| `GET /metrics` | Prometheus metrics |
| `GET /api-docs` | Swagger UI (dev only) |

### Docker Setup

If you prefer running everything in containers:

```bash
# Set required environment variables
export DB_PASSWORD=your-db-password
export REDIS_PASSWORD=your-redis-password

# Start PostgreSQL + Redis
docker compose up -d postgres redis

# Or start the full stack (app + postgres + redis)
docker compose up -d
```

The Docker Compose setup:
- Binds database ports to `127.0.0.1` only (not exposed externally)
- Requires `DB_PASSWORD` and `REDIS_PASSWORD` to be set (fails at startup otherwise)
- Runs migrations automatically before starting the app
- Mounts `./logs` for persistent log access

---

## Project Structure

```
src/
├── app.ts                        # Server bootstrap + graceful shutdown
├── createApp.ts                  # Express app factory (also used by tests)
├── tracing.ts                    # OpenTelemetry SDK initialization
├── config/
│   ├── env.ts                    # Zod-validated environment variables
│   ├── cookies.ts                # Shared cookie configuration
│   ├── versions.ts               # API version registry
│   └── swagger.ts                # Swagger/OpenAPI setup
├── constants/
│   └── errorMessages.ts          # Centralized error message strings
├── controllers/
│   ├── authController.ts         # Auth route handlers
│   └── healthController.ts       # Health + readiness checks
├── errors/                       # 10 typed error classes (AppError hierarchy)
├── middlewares/
│   ├── Auth.ts                   # JWT verification + silent refresh + RBAC
│   ├── Csrf.ts                   # CSRF double-submit (csrf-csrf)
│   ├── RateLimiter.ts            # Redis-backed rate limiting
│   ├── Idempotency.ts            # Request idempotency (opt-in)
│   ├── ApiVersion.ts             # Version headers (Deprecation, Sunset)
│   ├── Metrics.ts                # Prometheus request metrics
│   ├── RequestId.ts              # X-Request-ID + AsyncLocalStorage
│   ├── RequestLogger.ts          # HTTP request logging
│   ├── Validation.ts             # express-validator error handler
│   └── ErrorHandler.ts           # Global error handler
├── queues/
│   └── emailQueue.ts             # BullMQ email queue + worker
├── repositories/                 # Data access layer (Prisma)
│   ├── BaseRepository.ts         # Transaction helper
│   ├── UserRepository.ts
│   ├── TokenRepository.ts
│   └── OrganisationRepository.ts
├── routes/
│   ├── indexRoutes.ts            # Route aggregator
│   └── authRoutes.ts             # Auth endpoints
├── services/                     # Business logic
│   ├── authService.ts            # Auth operations
│   └── userService.ts            # User operations
├── templates/                    # Handlebars email templates
├── types/                        # TypeScript type definitions
│   ├── core/                     # Auth, Prisma, Express types
│   ├── api/                      # Request/response types
│   ├── repository/               # Repository types
│   ├── util/                     # Time constants, rate limiter
│   ├── queue/                    # Queue job types
│   └── media/                    # Media upload types
├── utils/
│   ├── logger.ts                 # Winston logger (with trace ID)
│   ├── auditLogger.ts            # Structured audit log
│   ├── prismaClient.ts           # Prisma client singleton
│   ├── redis/                    # Redis client, rate limiter, token blacklist
│   ├── circuitBreaker.ts         # Circuit breaker wrapper
│   ├── retry.ts                  # Exponential backoff with jitter
│   ├── pagination.ts             # Cursor pagination helper
│   ├── metrics.ts                # Prometheus registry + metrics
│   ├── password.ts               # bcrypt hash/verify
│   ├── sanitize.ts               # XSS sanitization (DOMPurify)
│   ├── dataSanitizer.ts          # Sensitive field redaction for logs
│   └── requestContext.ts         # AsyncLocalStorage for request ID
├── validations/                  # express-validator chains
└── websocket/                    # Socket.IO server + auth + handlers
prisma/
├── schema.prisma                 # 4 base models + enums
├── seed.ts                       # Seeds default org + superadmin
└── createSuperAdmin.ts           # Interactive CLI for production
k6/
├── smoke.js                      # Quick validation (1 VU, 30s)
├── load.js                       # Ramping load test (up to 50 VUs)
├── rate-limit.js                 # Rate limiting verification
└── lib/                          # Shared config + auth helpers
tests/
├── unit/                         # 71 unit tests across 7 files
├── integration/                  # 31 integration tests across 8 files
└── mocks/                        # Prisma stubs for unit tests
docs/
├── EXTENDING.md                  # How to add models, routes, services
├── api-versioning.md             # Versioning strategy + migration guide
└── graceful-degradation.md       # Failure mode documentation
```

---

## Base Schema

The template ships with 4 foundational models. Add your domain models below them in `prisma/schema.prisma`.

```prisma
model User {
  id, email, password, name, role, isVerified, isActive, deletedAt, timestamps
  → tokens[], memberships[]
}

model Token {
  id, token (unique), type, userId, expiresAt, createdAt
  → belongs to User (cascade delete)
}

model Organisation {
  id, name, slug (unique), isActive, deletedAt, timestamps
  → members[]
}

model OrganizationMember {
  id, userId, organisationId, role, createdAt
  → belongs to User + Organisation (cascade delete)
  → unique constraint on [userId, organisationId]
}
```

**Roles:** `SUPER_ADMIN` | `OWNER` | `ADMIN` | `MANAGER` | `MEMBER`

**Auth contexts:** `PLATFORM` | `ORGANIZATION`

---

## API Endpoints

### Authentication (`/v1/auth/`)

| Method | Endpoint | Auth | CSRF | Description |
|---|---|---|---|---|
| `POST` | `/v1/auth/login` | No | Yes | Login with email + password |
| `GET` | `/v1/auth/me` | Yes | No | Get current user |
| `POST` | `/v1/auth/logout` | Yes | Yes | Logout (revokes tokens) |
| `POST` | `/v1/auth/verify-email` | No | Yes | Verify email with token |
| `GET` | `/v1/auth/csrf-token` | No | No | Get CSRF token |

### System

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Optional | Health check (detailed in dev, minimal in prod) |
| `GET` | `/ready` | No | Readiness probe (checks DB + Redis) |
| `GET` | `/metrics` | Bearer | Prometheus metrics |
| `GET` | `/api-docs` | No | Swagger UI (dev only) |

### Auth Flow

```
1. GET  /v1/auth/csrf-token          → Get CSRF token (set in cookie + response)
2. POST /v1/auth/login               → Send credentials + X-CSRF-Token header
                                        ← Receive accessToken + refreshToken cookies
3. GET  /v1/auth/me                  → Auto-reads cookies, silent refresh if expired
4. POST /v1/auth/logout              → Revokes refresh token, blacklists access token
```

---

## Environment Variables

All variables are validated at startup with Zod. The server won't start with invalid configuration.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `PORT` | No | `3001` | Server port |
| `APP_VERSION` | No | `1.0.0` | App version (exposed in health check) |
| **Frontend** |  |  |  |
| `FRONTEND_URL` | Yes | - | Frontend URL for CORS + email links |
| `CORS_ORIGINS` | Yes | - | Comma-separated allowed origins |
| **Database** |  |  |  |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DB_POOL_SIZE` | No | `10` | Connection pool size (1–100) |
| **JWT** |  |  |  |
| `JWT_SECRET` | Yes | - | Signing secret (min 32 chars) |
| `JWT_ACCESS_EXPIRY` | No | `1h` | Access token TTL (ms-compatible: `15m`, `1h`, `2d`) |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token TTL |
| **Redis** |  |  |  |
| `REDIS_URL` | Yes | - | Redis connection URL |
| `REDIS_PASSWORD` | No | - | Redis password |
| **Email (SMTP)** |  |  |  |
| `EMAIL_HOST` | Yes | - | SMTP host |
| `EMAIL_PORT` | Yes | - | SMTP port |
| `EMAIL_SECURE` | No | `false` | Use TLS |
| `EMAIL_USER` | Yes | - | SMTP username |
| `EMAIL_PASSWORD` | Yes | - | SMTP password |
| `EMAIL_FROM` | Yes | - | Sender email address |
| **Rate Limiting** |  |  |  |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Window duration (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |
| **Logging** |  |  |  |
| `LOG_LEVEL` | No | `info` | Winston log level |
| **Security** |  |  |  |
| `SESSION_SECRET` | Yes | - | Session secret (min 32 chars) |
| `CSRF_SECRET` | Yes | - | CSRF secret (min 32 chars) |
| `COOKIE_DOMAIN` | No | - | Cookie domain (for cross-subdomain) |
| `HEALTH_API_KEY` | No | - | Bearer token for `/health` detail + `/metrics` (min 16 chars) |
| **Observability** |  |  |  |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | - | OTLP endpoint (enables tracing when set) |
| **Cloudinary (optional)** |  |  |  |
| `CLOUDINARY_CLOUD_NAME` | No | - | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | No | - | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | - | Cloudinary API secret |

---

## Available Scripts

### Development

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (nodemon) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start production server |
| `npm run start:migrate` | Run migrations then start (for containers) |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run format:check` | Prettier check |

### Database

| Script | Description |
|---|---|
| `npm run prisma:generate` | Generate Prisma client (+ barrel export) |
| `npm run prisma:migrate` | Create + apply migration |
| `npm run prisma:seed` | Seed default org + superadmin |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run create:superadmin` | Interactive production superadmin creation |

### Testing

| Script | Description |
|---|---|
| `npm test` | Run unit tests |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage |
| `npm run test:unit` | Run unit tests (explicit) |
| `npm run test:integration` | Run integration tests (needs Docker services) |
| `npm run test:all` | Run all tests |

### Load Testing (requires [k6](https://k6.io/docs/get-started/installation/))

| Script | Description |
|---|---|
| `npm run k6:smoke` | Quick smoke test (1 VU, 30s, strict thresholds) |
| `npm run k6:load` | Ramping load test (up to 50 VUs) |
| `npm run k6:rate-limit` | Verify rate limiting behavior |

### Docker

| Script | Description |
|---|---|
| `npm run docker:build` | Build Docker image |
| `npm run docker:up` | Start all services |
| `npm run docker:down` | Stop all services |
| `npm run docker:logs` | Tail application logs |
| `npm run docker:test:up` | Start test database + Redis |
| `npm run docker:test:down` | Tear down test services |

---

## Testing

### Unit Tests

Unit tests run with mocked Prisma and Redis - no external services needed.

```bash
npm test
```

71 tests across 7 suites: password utils, data sanitizer, XSS sanitizer, auth service, retry utility, idempotency middleware, cursor pagination.

### Integration Tests

Integration tests run against real PostgreSQL + Redis via Docker.

```bash
# Start test services (Postgres on 5433, Redis on 6380)
npm run docker:test:up

# Run integration tests
npm run test:integration

# Tear down
npm run docker:test:down
```

31 tests across 8 suites: full auth flows, token rotation, CSRF enforcement, health checks, email verification.

### Load Tests

```bash
# Start your server first
npm run dev

# Then in another terminal
npm run k6:smoke
```

---

## Deployment

### Docker (Recommended)

The included `Dockerfile` uses a multi-stage build:

1. **Builder stage** - installs all deps, generates Prisma client, compiles TypeScript
2. **Production stage** - installs only production deps, copies compiled output, runs as non-root user with `dumb-init`

```bash
# Build
docker build -t my-app-backend .

# Run
docker run -p 3001:3001 --env-file .env my-app-backend
```

### PM2

An `ecosystem.config.js` is included for PM2 process management:

```bash
pm2 start ecosystem.config.js
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set strong secrets for `JWT_SECRET`, `SESSION_SECRET`, `CSRF_SECRET` (min 32 chars each)
- [ ] Set `HEALTH_API_KEY` to protect health/metrics endpoints
- [ ] Set `COOKIE_DOMAIN` if using cross-subdomain auth
- [ ] Run `npx prisma migrate deploy` before starting
- [ ] Set up OTEL collector if using distributed tracing (`OTEL_EXPORTER_OTLP_ENDPOINT`)
- [ ] Review rate limit settings for your expected traffic
- [ ] Set up log aggregation (application writes to `logs/`)

---

## Extending the Template

See [`docs/EXTENDING.md`](docs/EXTENDING.md) for detailed guides on:
- Adding new Prisma models
- Creating repositories, services, controllers, and routes
- Adding WebSocket events and handlers

See [`docs/api-versioning.md`](docs/api-versioning.md) for:
- API versioning strategy and deprecation lifecycle
- Step-by-step guide to creating a v2 API
- Client migration template

See [`docs/graceful-degradation.md`](docs/graceful-degradation.md) for:
- Failure modes of all Redis-dependent features
- PostgreSQL and SMTP failure behavior
- Operator checklist for monitoring

### Adding a New API Route (Quick Example)

```bash
# 1. Add model to prisma/schema.prisma
# 2. Run migration
npx prisma migrate dev --name add-posts

# 3. Create files following the pattern:
#    src/repositories/PostRepository.ts
#    src/services/postService.ts
#    src/controllers/postController.ts
#    src/routes/postRoutes.ts
#    src/validations/postValidations.ts

# 4. Mount in src/routes/indexRoutes.ts
#    router.use("/posts", postRoutes);
```

---

## CI/CD

Two GitHub Actions workflows are included:

### `ci.yml` - Main Pipeline
Runs on every push and PR:
- Lint (ESLint) + Format check (Prettier)
- TypeScript type check
- Unit tests + Integration tests (with Postgres + Redis service containers)
- Prisma schema validation + migration verification
- Docker build
- Trivy security scanning (filesystem + container image)

### `smoke-test.yml` - Load Test
Runs weekly + on-demand:
- Starts the full stack (app + Postgres + Redis)
- Seeds the database
- Runs k6 smoke tests against the live server

---

## RBAC Middleware

The template includes ready-to-use RBAC middleware:

```typescript
import { requireSuperAdmin, requireOrganizationRole, requirePlatformContext } from "./middlewares/Auth";

// Platform-level: only super admins
router.get("/admin/users", requireSuperAdmin, listUsers);

// Organization-level: owners and admins
router.get("/orgs/:orgId/settings",
  requireOrganizationRole(Role.OWNER, Role.ADMIN),
  getOrgSettings
);
```

---

## License

ISC
