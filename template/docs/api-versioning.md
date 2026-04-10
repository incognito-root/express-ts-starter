# API Versioning Strategy

## Current State

| Version | Status  | Path prefix |
|---------|---------|-------------|
| v1      | Current | `/v1/`      |

All versioned routes respond with `X-API-Version: v1` so clients can detect the active version.

---

## Versioning Policy

This API uses **URL path versioning** (`/v1/`, `/v2/`). It is the most explicit strategy: version is visible in logs, curl output, proxy rules, and rate-limit keys without requiring custom headers or content-type negotiation.

### What requires a new major version

A new version (`/v2/`) is required for any **breaking change** to existing behaviour:

- Renaming, removing, or retyping a response field
- Changing a field from optional to required
- Changing authentication/cookie semantics
- Changing error response shapes
- Removing an endpoint
- Changing URL structure or HTTP method for an existing endpoint

### What does NOT require a new version

Additive, backward-compatible changes can ship in the current version:

- Adding optional request fields
- Adding new response fields
- Adding new endpoints
- Changing default values in a forward-compatible way
- Performance or internal implementation changes

---

## Deprecation Lifecycle

When a new version makes the previous one obsolete, follow this process:

```
Ship v2               Mark v1 deprecated         Sunset date passes       Remove v1
─────────────────────────────────────────────────────────────────────────────────────
 v1 = current         v1 = deprecated             (v1 still works)        v1 removed
 v2 = current         deprecatedAt = now           sunsetAt = future date
                      sunsetAt = +6 months        Clients must migrate
                      Deprecation + Sunset
                      headers on all v1 responses
```

Minimum recommended deprecation window: **6 months** (3 months for non-production environments).

### Setting deprecation headers

Update `src/config/versions.ts`. No middleware changes needed:

```typescript
export const API_VERSIONS: Record<string, VersionConfig> = {
  v1: {
    version: "v1",
    status: "deprecated",
    deprecatedAt:  "Sat, 01 Feb 2026 00:00:00 GMT",
    sunsetAt:      "Sat, 01 Aug 2026 00:00:00 GMT",
    migrationGuide: "https://docs.example.com/migrate-v1-to-v2",
  },
  v2: {
    version: "v2",
    status: "current",
  },
};
```

Once set, every response from `/v1/*` automatically includes:

```
X-API-Version: v1
Deprecation: Sat, 01 Feb 2026 00:00:00 GMT
Sunset: Sat, 01 Aug 2026 00:00:00 GMT
Link: <https://docs.example.com/migrate-v1-to-v2>; rel="deprecation"
```

---

## Adding v2 — Step by Step

### 1. Create the v2 route tree

Mirror the v1 structure under a new directory:

```
src/routes/
  indexRoutes.ts        ← v1 (existing)
  v2/
    indexRoutes.ts      ← v2 root
    authRoutes.ts       ← v2 auth (only changed endpoints need new handlers)
```

`src/routes/v2/indexRoutes.ts`:
```typescript
import express from "express";
import authRoutes from "./authRoutes";

const router = express.Router();
router.use("/auth", authRoutes);
export default router;
```

### 2. Mount the v2 router in createApp.ts

```typescript
import { apiVersionMiddleware } from "./middlewares/ApiVersion";
import v2Router from "./routes/v2/indexRoutes";

// Existing v1 mount (unchanged):
app.use("/v1", apiVersionMiddleware("v1"), router);

// New v2 mount:
app.use("/v2", apiVersionMiddleware("v2"), v2Router);
```

### 3. Add v2 config entry

In `src/config/versions.ts`, add:
```typescript
v2: {
  version: "v2",
  status: "current",
},
```

And update v1 status to `"deprecated"` (with dates and migration guide).

### 4. Add v2 Swagger docs

In `src/config/swagger.ts`, update the `apis` glob or add a server entry:

```typescript
servers: [
  { url: `http://localhost:${env.PORT}/v2`, description: "v2 (current)" },
  { url: `http://localhost:${env.PORT}/v1`, description: "v1 (deprecated)" },
],
apis: [
  "./src/routes/*.ts",
  "./src/routes/v2/*.ts",
  "./src/controllers/*.ts",
],
```

### 5. Reuse v1 controllers where there are no breaking changes

v2 routes can import and re-use v1 controllers for unchanged endpoints:

```typescript
// src/routes/v2/authRoutes.ts
import * as authController from "../../controllers/authController";  // unchanged
import * as authV2Controller from "../../controllers/v2/authController"; // breaking change
```

Only create a `src/controllers/v2/` subdirectory for handlers whose response shape changed.

---

## Response Shape Compatibility

When a response field changes meaning or type in v2, keep the v1 shape in the v1 controller and introduce the new shape only in the v2 controller. Never silently change a field value in a shared controller.

Example — renaming `user.name` to `user.displayName` in v2:

```typescript
// v1 controller (unchanged)
res.json({ user: { id, name, email } });

// v2 controller
res.json({ user: { id, displayName: name, email } });
```

---

## Client Migration Guide Template

When publishing a migration guide for clients moving from v1 to v2, include:

1. **What changed** — table of renamed/removed/retyped fields per endpoint
2. **What's the same** — list of endpoints with no breaking changes
3. **Parallel running period** — both versions live until the sunset date
4. **Code examples** — before/after SDK or fetch snippets
5. **Contact** — support channel for migration questions
