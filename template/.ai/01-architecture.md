# Architecture — {{PROJECT_NAME}}

## The 4-Layer Pattern

Every HTTP request in this codebase flows through exactly four layers. ESLint's `no-restricted-imports` rule enforces the boundary between layers at build time.

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────┐
│  Route  (src/routes/)                           │
│  • Register URL path on the Express router      │
│  • Attach middleware (auth, validation, CSRF)   │
│  • Call the controller method                   │
│  ✗ No business logic  ✗ No DB  ✗ No service calls
└─────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│  Controller  (src/controllers/)                 │
│  • Parse validated req.body / req.params        │
│  • Call exactly one service method              │
│  • Format and send the HTTP response            │
│  ✗ No business logic  ✗ No DB  ✗ No Prisma     │
└─────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│  Service  (src/services/)                       │
│  • ALL business logic lives here                │
│  • Orchestrate multiple repository calls        │
│  • Throw typed AppError subclasses on failures  │
│  ✗ Never imports prismaClient or Prisma         │
│  ✗ Never calls res.json() or touches HTTP       │
└─────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│  Repository  (src/repositories/)                │
│  • The ONLY layer that imports prismaClient     │
│  • Wraps Prisma queries in domain-specific methods
│  • All methods accept an optional tx? parameter │
│  • Extends BaseRepository for shared utilities  │
│  ✗ No business logic  ✗ No HTTP concerns        │
└─────────────────────────────────────────────────┘
     │
     ▼
Prisma  (generated/prisma/client.ts)
```

## Module Boundary Enforcement

ESLint `no-restricted-imports` in `.eslintrc.js` makes importing `prismaClient` outside `src/repositories/**` a **build error**. This is intentional and must not be disabled.

Overrides per layer:
- `src/repositories/**` — `no-restricted-imports` off, all unsafe TypeScript rules off
- `src/controllers/**` and `src/middlewares/**` — unsafe TypeScript rules demoted to warn
- `src/services/**` — all unsafe rules as warn

## Middleware Stack (createApp.ts)

Order matters. The stack in `src/createApp.ts` is applied in this sequence:

```
1.  app.set("trust proxy", 1)              ← correct req.ip behind nginx/load balancer
2.  helmet(...)                            ← security headers; CSP configured
3.  requestIdMiddleware                    ← X-Request-ID + AsyncLocalStorage context
4.  metricsMiddleware         [feature]    ← Prometheus request duration
5.  requestLogger                          ← HTTP access log via Winston
6.  compression()                          ← gzip
7.  cookieParser()                         ← parse cookies before auth middleware
8.  express.json({ limit: "1mb" })         ← parse JSON bodies
9.  express.urlencoded(...)                ← parse form bodies
10. sanitizeJsonInput(req.body)            ← recursive XSS sanitization (inline)
11. cors(...)                              ← explicit allowedHeaders + exposedHeaders
12. /health + /ready                       ← before auth; unauthenticated
13. /metrics                   [feature]   ← optional API key guard
14. Swagger UI at /api-docs                ← dev only
15. /v1 router                             ← all application routes
16. 404 catch-all                          ← structured JSON 404
17. errorHandler                           ← MUST be last; global error formatter
```

Never reorder these without understanding the security implications.

## Request Lifecycle

```
1. Request arrives
2. Request ID assigned (X-Request-ID header or generated UUID)
3. Request logged (method, URL, IP)
4. Body parsed + sanitized
5. CORS headers applied
6. Route matched
7. Auth middleware verifies JWT from cookie, attaches req.user
8. CSRF middleware verifies CSRF token (state-changing routes)
9. Rate limiter checks Redis (fails closed)
10. Validation middleware parses and validates body via Zod schema
11. Controller method is called
12. Controller calls service
13. Service calls repository/repositories
14. Repository executes Prisma query
15. Response flows back: repository → service → controller → sendSuccess()
16. On any throw: error propagates to the global errorHandler
17. errorHandler formats the error and sends JSON response
```

## App Startup Sequence (app.ts)

The startup order in `src/app.ts` is **critical**. Do not change it:

```
1. dotenv.config()           ← env vars must exist before anything else
2. validateEnv()             ← Zod validation; exits process if vars missing
3. import tracing            ← OTEL must instrument Express BEFORE it loads
4. import createApp          ← Express factory (after tracing patches)
5. http.createServer(app)    ← timeout config: 30s request, 65s keep-alive
6. initializeEmailService()  ← SMTP connection (non-fatal if fails)
7. initializeRedis()         ← Redis connection (non-fatal; features degrade)
8. initializeWebSocket()     ← Socket.IO (only if Redis ok)
9. server.listen(PORT)       ← start accepting connections
```

Graceful shutdown on SIGTERM/SIGINT:
WebSocket → BullMQ queues → Redis → HTTP server → Prisma → OTel
Force-exit after 10 seconds.

## Directory Structure

```
src/
├── app.ts                  # Entry point
├── createApp.ts            # Express factory (also used by supertest)
├── tracing.ts              # OTEL SDK init [feature: otel]
├── config/
│   ├── env.ts              # Zod env schema; import validateEnv from here
│   ├── cookies.ts          # Shared cookie option presets
│   ├── swagger.ts          # OpenAPI config
│   ├── versions.ts         # API version registry [feature: versioning]
│   └── imagePresets.ts     # Upload config [feature: uploads]
├── constants/
│   └── errorMessages.ts    # All user-facing error strings; never hardcode in services
├── controllers/            # One file per domain (authController.ts, etc.)
├── errors/                 # AppError + 10 typed subclasses
├── middlewares/
│   ├── Auth.ts             # JWT cookie verification + req.user attachment
│   ├── Csrf.ts             # Double-submit cookie [feature: csrf]
│   ├── ErrorHandler.ts     # Global error formatter (must be last middleware)
│   ├── Idempotency.ts      # Redis-backed idempotency [feature: idempotency]
│   ├── Metrics.ts          # Prometheus collection [feature: metrics]
│   ├── RateLimiter.ts      # Express wrapper for redisRateLimiter
│   ├── RequestId.ts        # UUID generation + AsyncLocalStorage
│   ├── RequestLogger.ts    # Winston HTTP access log
│   ├── Validation.ts       # Zod body parsing middleware factory
│   └── ApiVersion.ts       # Version header injection [feature: versioning]
├── queues/
│   └── emailQueue.ts       # BullMQ worker + job types [feature: bullmq]
├── repositories/
│   ├── BaseRepository.ts   # withTransaction() + common utils
│   ├── UserRepository.ts
│   ├── TokenRepository.ts
│   └── OrganisationRepository.ts
├── routes/
│   ├── authRoutes.ts
│   └── indexRoutes.ts
├── services/
│   ├── authService.ts
│   └── userService.ts
├── types/                  # Barrel re-exports
│   ├── index.ts            # Master export file
│   ├── core/               # User, Token, Org types
│   ├── api/                # Request/response DTOs
│   ├── repository/         # Repository input/output types
│   ├── util/               # Shared utility types
│   ├── queue/              # BullMQ job types [feature: bullmq]
│   └── websocket/          # Socket event types [feature: websocket]
├── utils/
│   ├── logger.ts           # Winston — always use this
│   ├── prismaClient.ts     # Prisma singleton — repositories only
│   ├── circuitBreaker.ts   # [feature: circuitBreaker]
│   ├── auditLogger.ts      # [feature: audit]
│   ├── metrics.ts          # prom-client registry [feature: metrics]
│   ├── retry.ts            # withRetry<T> with exponential backoff + jitter
│   ├── requestContext.ts   # AsyncLocalStorage request-scoped context
│   ├── dataSanitizer.ts    # PII masking for logs
│   ├── sanitize.ts         # XSS sanitization for req.body
│   ├── pagination.ts       # CursorPaginationHelper
│   ├── password.ts         # bcrypt wrappers
│   ├── validation.ts       # Zod helpers
│   ├── http/response.ts    # sendSuccess / sendError
│   ├── emails/             # emailService, templates, nodemailerProvider
│   ├── redis/              # redisClient, redisRateLimiter, tokenBlacklist, redisOtpManager
│   └── media/              # MediaService + providers [feature: uploads]
├── validations/
│   └── authValidations.ts  # Zod schemas for auth routes
└── websocket/              # Socket.IO [feature: websocket]

prisma/
├── schema.prisma
├── seed.ts
└── createSuperAdmin.ts

tests/
├── mocks/prisma.ts         # Prisma stub — use in unit tests
├── setup.ts
├── unit/
└── integration/
```
