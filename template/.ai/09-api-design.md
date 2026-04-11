# API Design — {{PROJECT_NAME}}

## URL Structure

All application routes are under the `/v1` prefix:

```
/health           ← Health check; no auth; no versioning prefix
/ready            ← Readiness probe; no auth; no versioning prefix
/metrics          ← Prometheus metrics; optional API key guard [feature: metrics]
/api-docs         ← Swagger UI; development only
/v1/auth/...      ← Auth routes (login, register, logout, refresh, etc.)
/v1/users/...     ← User routes
```

Place new domain routes under `/v1/<domain>/`. When adding a v2, create a new router and wire it at `/v2/`.

---

## Response Format

Use the response helpers from `src/utils/http/response.ts`. Never call `res.json()` directly in controllers.

```typescript
import { sendSuccess, sendError } from "../utils/http/response";

// Success response
sendSuccess(res, data);                    // 200 OK
sendSuccess(res, data, "User created", 201); // 201 Created
sendSuccess(res, null, "Logged out", 204); // 204 No Content

// Error response — prefer throwing over calling sendError directly
// This ensures the error goes through the global handler consistently
throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
```

**Success response shape:**
```json
{
  "success": true,
  "message": "User created",
  "data": { "id": "usr_123", "email": "user@example.com" }
}
```

**Error response shape (from errorHandler):**
```json
{
  "success": false,
  "error": "User not found",
  "code": "USER_NOT_FOUND",
  "requestId": "req_abc123"
}
```

Paginated response shape:
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "nextCursor": "eyJpZCI6InVzcl8xMjMifQ",
    "hasNext": true
  }
}
```

---

## Request Validation

Every mutating endpoint uses Zod validation via the `validateBody` middleware.

### Adding validation to a route

```typescript
// 1. Define schema in src/validations/postValidations.ts
import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

export type CreatePostDTO = z.infer<typeof createPostSchema>;

// 2. Apply in the route
import { validateBody } from "../middlewares/Validation";
import { createPostSchema } from "../validations/postValidations";

router.post("/posts", authMiddleware, csrfMiddleware, validateBody(createPostSchema), postController.create);

// 3. Access the typed body in the controller
const data = req.body as CreatePostDTO; // req.body is the Zod-parsed + typed value
```

**Validation failures** return `422 UnprocessableEntityError` with Zod's error details in the response body.

**Also validate query parameters** for paginated/filtered endpoints:

```typescript
const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// In controller
const { cursor, limit } = paginationSchema.parse(req.query);
```

---

## API Versioning [feature: versioning]

The project uses URL path versioning (`/v1`, `/v2`).

### Version registry (`src/config/versions.ts`)

Contains version metadata including deprecation dates. To add a v2:
1. Add `v2` entry to the versions config
2. Create `src/routes/v2Routes.ts`
3. Wire at `/v2` in `createApp.ts`
4. Reuse controller methods where possible; only create new controller methods for changed behaviour

### Setting deprecation headers

When a version is being sunset, the `ApiVersion` middleware [feature: versioning] automatically adds:
```
Deprecation: Sat, 01 Jan 2026 00:00:00 GMT
Sunset: Fri, 01 Jul 2026 00:00:00 GMT
Link: <https://api.example.com/v2>; rel="successor-version"
```

Breaking changes that require a new version:
- Removing or renaming a field in the response
- Changing the type of an existing field
- Removing an endpoint
- Changing required/optional status of a request field

Non-breaking changes (no new version needed):
- Adding new optional response fields
- Adding new optional request parameters
- Adding new endpoints
- Bug fixes

---

## Cursor Pagination

All list endpoints use cursor-based pagination. **Never use offset pagination** (no `page` / `skip` parameters).

```typescript
// Zod schema for paginated endpoints
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// In controller
const { cursor, limit } = listQuerySchema.parse(req.query);
const result = await this.postService.listPosts({ cursor, limit });
sendSuccess(res, result);
```

Cursors are **opaque base64url strings** encoding the last item's ID. Never expose the underlying ID directly as a cursor. The `CursorPaginationHelper` handles encoding/decoding and validation.

---

## HTTP Status Codes Reference

| Code | Name | When to use |
|---|---|---|
| `200` | OK | GET, successful PUT/PATCH update |
| `201` | Created | Successful POST that creates a resource |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Malformed request (missing required field, wrong format) |
| `401` | Unauthorized | Missing or invalid auth token |
| `403` | Forbidden | Valid token, but insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate resource, state conflict |
| `422` | Unprocessable Entity | Zod validation failure (semantically invalid input) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server fault |

**Distinguish 400 from 422:**
- `400` — structurally wrong request (missing required header, wrong content-type)
- `422` — structurally valid but semantically invalid (Zod schema violations, business rule violations on input)

---

## Content Negotiation

- **Request bodies**: Always `Content-Type: application/json`
- **File uploads**: `Content-Type: multipart/form-data` (via Multer middleware [feature: uploads])
- **Responses**: Always `Content-Type: application/json`

The `express.json({ limit: "1mb" })` middleware rejects bodies over 1MB with a 400.

---

## Idempotency [feature: idempotency]

For operations where the client may retry (network failures, timeouts), the `Idempotency` middleware prevents duplicate state changes.

Clients send an `Idempotency-Key: <uuid>` header. The middleware:
1. First call: processes normally, caches the response in Redis with the key
2. Subsequent calls with same key: returns the cached response immediately
3. Concurrent calls with same key: blocks via Redis SET NX lock, then serves cached result

If Redis is unavailable, the middleware **fails open** (processes normally without idempotency guarantee).

Apply to payment, order, or other operations where duplicate processing would be harmful.
