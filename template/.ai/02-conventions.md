# Naming & File Conventions — {{PROJECT_NAME}}

## File Naming by Layer

| Layer | Convention | Examples |
|---|---|---|
| Middleware | `PascalCase.ts` | `Auth.ts`, `RateLimiter.ts`, `ErrorHandler.ts` |
| Controller | `camelCase` + `Controller.ts` | `authController.ts`, `userController.ts` |
| Service | `camelCase` + `Service.ts` | `authService.ts`, `userService.ts` |
| Repository | `PascalCase` + `Repository.ts` | `UserRepository.ts`, `TokenRepository.ts` |
| Route | `camelCase` + `Routes.ts` | `authRoutes.ts`, `indexRoutes.ts` |
| Validation | `camelCase` + `Validations.ts` | `authValidations.ts` |
| Config | `camelCase.ts` | `env.ts`, `cookies.ts`, `swagger.ts` |
| Utility | `camelCase.ts` | `logger.ts`, `pagination.ts`, `retry.ts` |
| Type barrel | `index.ts` | `src/types/index.ts` |
| Error class | `PascalCase` + `Error.ts` or grouped in `src/errors/index.ts` | |
| Test | `*.test.ts` mirroring source path | `tests/unit/services/authService.test.ts` |

## TypeScript: Interface vs Type

Use **`interface`** for:
- Data shapes that represent objects (DTOs, request/response bodies)
- Repository input/output types
- Things that might be extended in the future

```typescript
// Correct
export interface CreateUserDTO {
  email: string;
  password: string;
  name: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasNext: boolean;
}
```

Use **`type`** for:
- Union types
- Mapped types
- Function signatures
- Intersections

```typescript
// Correct
export type UserRole = "admin" | "member" | "viewer";
export type WithTimestamps<T> = T & { createdAt: Date; updatedAt: Date };
export type AsyncHandler = (req: Request, res: Response) => Promise<void>;
```

## TypeScript Strictness Rules

The project runs TypeScript strict mode. Follow these patterns:

**Explicit return types on public functions:**
```typescript
// Services and repositories should have explicit return types
async findById(id: string): Promise<User | null> {
  // ...
}
```

**No implicit `any` — use `unknown` with type guards:**
```typescript
// Wrong
function processData(data: any) { ... }

// Correct
function processData(data: unknown) {
  if (typeof data !== "object" || data === null) throw new BadRequestError("Invalid data");
  // now safe to use
}
```

**`readonly` for immutable data:**
```typescript
interface Config {
  readonly jwtSecret: string;
  readonly port: number;
}
```

**Unused parameters: prefix with `_`:**
```typescript
// ESLint ignores _-prefixed unused params/vars
app.use((_req, _res, next) => { next(); });
```

## Import Order (ESLint `import/order` — enforced)

Groups must appear in this order with a **blank line between each group**:

```typescript
// Group 1: Node.js built-ins (with "node:" prefix)
import path from "node:path";
import fs from "node:fs";

// Group 2: External packages
import express from "express";
import { z } from "zod";

// Group 3: Internal absolute imports
import logger from "../utils/logger";
import { NotFoundError } from "../errors";

// Group 4: Parent/sibling/index relative imports
import { UserRepository } from "./UserRepository";
```

**Within each group, imports are alphabetized.**

## Named Exports (never default for utilities/services)

```typescript
// Correct — named export
export class UserService { ... }
export function sendSuccess(...) { ... }

// Exception — config singletons that mirror Node convention
export default prisma;       // src/utils/prismaClient.ts
export default logger;       // src/utils/logger.ts
```

## Barrel Exports via `src/types/index.ts`

All DTO and type definitions exported from `src/types/index.ts`. Import types from the barrel, not the individual files:

```typescript
// Correct
import type { CreateUserDTO, UserRole } from "../types";

// Wrong — import from the sub-module directly
import type { CreateUserDTO } from "../types/repository/user";
```

**Adding new types:**
1. Create the type in the appropriate `src/types/<domain>/` sub-directory
2. Add an `export *` line in `src/types/index.ts`

## Constant Naming

| Scope | Convention | Example |
|---|---|---|
| Module-level constants | `UPPER_SNAKE_CASE` | `MAX_LOGIN_ATTEMPTS`, `TOKEN_EXPIRY_MS` |
| Local constants | `camelCase` | `const tokenExpiry = ...` |
| Enum-like string unions | `PascalCase` members via `type` | `type Status = "active" \| "inactive"` |

## Error Message Strings

All user-facing error message strings live in `src/constants/errorMessages.ts`. **Never hardcode error message text in services or controllers.**

```typescript
// Correct
throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);

// Wrong
throw new NotFoundError("User not found");
```

## Comment Style

Add comments **only where the logic is non-obvious**. Do not add comments that restate what the code does.

```typescript
// Wrong — restates the code
// Check if user exists
const user = await this.userRepository.findById(id);

// Correct — explains why
// Check consumed token before creating new one; count === 0 means already-rotated token
const count = await this.tokenRepository.deleteById(oldTokenId);
if (count === 0) throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_ALREADY_USED);
```

JSDoc comments on exported public-facing functions are appropriate when the function signature alone is insufficient.
