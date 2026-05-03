# create-express-ts-starter

A CLI tool that scaffolds production-ready Express + TypeScript backend projects. Pick a preset or hand-pick features, and get a working project in seconds.

```bash
npx @incognito-root/create-express-ts-starter my-app
```

---

## Usage

### Interactive (default)

```bash
npx @incognito-root/create-express-ts-starter my-app
```

You'll be prompted to choose a preset or select individual features, set your production URL, database name, and whether to initialize git / install dependencies.

### Non-interactive

```bash
# Use a preset and skip all prompts
npx @incognito-root/create-express-ts-starter my-app --preset full --yes

# Minimal setup, no git, no install
npx @incognito-root/create-express-ts-starter my-app --preset minimal --yes --no-git --no-install
```

### CLI Flags

| Flag              | Description                                       |
| ----------------- | ------------------------------------------------- |
| `--preset <name>` | Use a preset: `minimal`, `recommended`, or `full` |
| `--yes`           | Skip all prompts, use defaults                    |
| `--no-git`        | Skip `git init`                                   |
| `--no-install`    | Skip `npm install`                                |

---

## Presets

| Preset          | What's included                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **minimal**     | Core Express + TypeScript + Prisma + Redis + Auth + Helmet + Rate limiting + Logging. No optional features. |
| **recommended** | Minimal + BullMQ email queue, Prometheus metrics, API versioning, CSRF protection, audit logging, Resend default email provider |
| **full**        | Everything enabled (all 13 optional features)                                                               |

---

## Optional Features

All presets include the core stack. These features can be toggled on or off:

| Feature                | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| WebSocket (Socket.IO)  | Real-time communication with Redis adapter for horizontal scaling |
| File Uploads           | Multer + Cloudinary storage with image presets                    |
| Email Queue (BullMQ)   | Background email processing via Redis-backed queue                |
| Prometheus Metrics     | HTTP request metrics and `/metrics` endpoint via prom-client      |
| OpenTelemetry Tracing  | Distributed tracing with OTLP exporter                            |
| API Versioning         | URL path versioning with RFC 8594 deprecation/sunset headers      |
| Idempotency Middleware | Redis-backed idempotency guard for safe request retries           |
| Circuit Breaker        | Resilience pattern for external service calls (opossum)           |
| Resend Email Provider  | Sets `EMAIL_PROVIDER=resend` in generated `.env.example`          |
| CSRF Protection        | Double-submit cookie CSRF via csrf-csrf                           |
| Audit Logger           | Structured audit logging with daily rotation                      |
| k6 Load Tests          | Pre-built smoke, load, and rate-limit test scripts                |
| PM2 Ecosystem          | PM2 process manager config for production                         |

---

## Core Stack (always included)

| Layer      | Technology                                                       |
| ---------- | ---------------------------------------------------------------- |
| Runtime    | Node.js 20, Express 5, TypeScript 5                              |
| Database   | PostgreSQL 16 + Prisma 7                                         |
| Cache      | Redis 7                                                          |
| Auth       | JWT dual-token (httpOnly cookies), bcrypt                        |
| Validation | Zod (env), express-validator (requests)                          |
| Logging    | Winston + daily rotate, request ID correlation                   |
| Security   | Helmet, Redis-backed rate limiting, XSS sanitization (DOMPurify) |
| Testing    | Vitest 4, Supertest                                              |

---

## After Scaffolding

```bash
cd my-app

# If you skipped install:
npm install

# Generate Prisma client
npm run prisma:generate

# Edit .env with your actual values
# (a .env.example is included)

# Run database migration
npx prisma migrate dev --name init

# Seed the database (creates default org + superadmin)
npm run prisma:seed

# Start development
npm run dev
```

The server starts at `http://localhost:3001`.

### Key Endpoints

| Endpoint        | Description                                     |
| --------------- | ----------------------------------------------- |
| `GET /health`   | Health check (detailed in dev, minimal in prod) |
| `GET /ready`    | Readiness probe (checks DB + Redis)             |
| `GET /metrics`  | Prometheus metrics (if enabled, Bearer-gated)   |
| `GET /api-docs` | Swagger UI (dev only)                           |

---

## Generated Project Structure

```
src/
├── app.ts                    # Server bootstrap + graceful shutdown
├── createApp.ts              # Express app factory (also used by tests)
├── config/
│   └── env.ts                # Zod-validated environment variables
├── controllers/
│   ├── authController.ts     # Auth route handlers
│   └── healthController.ts   # Health + readiness checks
├── errors/                   # Typed error classes (AppError hierarchy)
├── middlewares/
│   ├── Auth.ts               # JWT verification + silent refresh + RBAC
│   ├── RateLimiter.ts        # Redis-backed rate limiting
│   ├── RequestId.ts          # X-Request-ID + AsyncLocalStorage
│   ├── RequestLogger.ts      # HTTP request logging
│   ├── Validation.ts         # express-validator error handler
│   └── ErrorHandler.ts       # Global error handler
├── repositories/             # Data access layer (Prisma)
├── routes/
│   ├── indexRoutes.ts        # Route aggregator
│   └── authRoutes.ts         # Auth endpoints
├── services/                 # Business logic
├── types/                    # TypeScript type definitions
├── utils/
│   ├── logger.ts             # Winston logger
│   ├── prismaClient.ts       # Prisma client singleton
│   ├── redis/                # Redis client, rate limiter, token blacklist
│   └── ...
├── validations/              # express-validator chains
prisma/
├── schema.prisma             # Base models + enums
├── seed.ts                   # Seeds default org + superadmin
└── createSuperAdmin.ts       # Interactive CLI for production
tests/
├── unit/
├── integration/
└── mocks/
```

Additional directories are added based on selected features (e.g. `src/websocket/`, `src/queues/`, `k6/`).

---

## Base Schema

The generated project ships with 4 foundational models. Add your domain models in `prisma/schema.prisma`.

```prisma
model User {
  id, email, password, name, role, isVerified, isActive, deletedAt, timestamps
}

model Token {
  id, token (unique), type, userId, expiresAt, createdAt
}

model Organization {
  id, name, slug (unique), isActive, deletedAt, timestamps
}

model OrganizationMember {
  id, userId, organizationId, role, createdAt
  unique constraint on [userId, organizationId]
}
```

**Roles:** `SUPER_ADMIN` | `OWNER` | `ADMIN` | `MANAGER` | `MEMBER`

---

## Prerequisites

- **Node.js** >= 20
- **PostgreSQL** >= 15
- **Redis** >= 7
- **npm** >= 9

---

## Docker (in generated project)

The generated project includes a multi-stage Dockerfile and docker-compose setup:

```bash
cd my-app

# Set required environment variables
export DB_PASSWORD=your-db-password
export REDIS_PASSWORD=your-redis-password

# Start PostgreSQL + Redis
docker compose up -d postgres redis

# Or start the full stack
docker compose up -d
```

---

## Available Scripts (in generated project)

| Script                     | Description                                   |
| -------------------------- | --------------------------------------------- |
| `npm run dev`              | Start dev server with hot reload (nodemon)    |
| `npm run build`            | Compile TypeScript to `dist/`                 |
| `npm start`                | Start production server                       |
| `npm test`                 | Run unit tests                                |
| `npm run test:integration` | Run integration tests (needs Docker services) |
| `npm run prisma:generate`  | Generate Prisma client                        |
| `npm run prisma:migrate`   | Create + apply migration                      |
| `npm run prisma:seed`      | Seed default org + superadmin                 |

Additional scripts are included depending on selected features (k6 load tests, Docker commands, etc.).

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set strong secrets for `JWT_SECRET`, `SESSION_SECRET` (min 32 chars each)
- [ ] Set `HEALTH_API_KEY` to protect health/metrics endpoints
- [ ] Run `npx prisma migrate deploy` before starting
- [ ] Review rate limit settings for your expected traffic
- [ ] Set up log aggregation (application writes to `logs/`)

---

## License

MIT
