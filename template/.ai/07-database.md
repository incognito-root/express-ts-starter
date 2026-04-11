# Database & Prisma — {{PROJECT_NAME}}

## The Fundamental Rule

**`prismaClient` may ONLY be imported in `src/repositories/**`.**

ESLint's `no-restricted-imports` rule makes this a **build error** everywhere else. If a service needs data, it calls a repository method. It does not import Prisma.

```typescript
// ❌ This is a build error in src/services/, src/controllers/, etc.
import prisma from "../utils/prismaClient";

// ✅ Use a repository
class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getUserById(id: string) {
    return this.userRepository.findById(id);
  }
}
```

---

## Prisma Client Setup

- Singleton: `src/utils/prismaClient.ts`
- Driver: `pg` PostgreSQL adapter (not the default Prisma connector)
- Generated output: `generated/prisma/client.ts` (custom path, not `node_modules`)
- The `prisma:generate` script also creates `generated/prisma/index.ts` as a barrel

When running Vitest integration tests, an alias resolves `.*generated\/prisma.*` → `generated/prisma/client.ts` to handle the custom output path correctly.

---

## BaseRepository

All repositories extend `BaseRepository` from `src/repositories/BaseRepository.ts`.

Key utilities from `BaseRepository`:

### `withTransaction<T>(fn: (tx) => Promise<T>): Promise<T>`

Use for any operation that requires multiple database writes to succeed or fail atomically:

```typescript
// In a service, using a repository that extends BaseRepository:
async rotateRefreshToken(oldTokenId: string, newTokenData: CreateTokenDTO) {
  return this.tokenRepository.withTransaction(async (tx) => {
    // Step 1: Delete the consumed token
    const count = await this.tokenRepository.deleteById(oldTokenId, tx);

    // Step 2: If count === 0, the token was already used (rotation attack)
    if (count === 0) throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_ALREADY_USED);

    // Step 3: Create the new token — only reaches here if step 1 succeeded
    return this.tokenRepository.create(newTokenData, tx);
  });
}
```

---

## Repository Pattern

### Creating a new repository

1. Define DTO types in `src/types/repository/<domain>.ts`:
```typescript
export interface CreatePostDTO {
  title: string;
  content: string;
  authorId: string;
}

export interface UpdatePostDTO {
  title?: string;
  content?: string;
  publishedAt?: Date | null;
}
```

2. Export from `src/types/index.ts`:
```typescript
export * from "./repository/post";
```

3. Create `src/repositories/PostRepository.ts`:
```typescript
import prisma from "../utils/prismaClient";
import { BaseRepository } from "./BaseRepository";
import type { CreatePostDTO, UpdatePostDTO } from "../types";
import type { PrismaTransactionClient } from "../types";

export class PostRepository extends BaseRepository {
  async findById(id: string, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.post.findUnique({ where: { id } });
  }

  async create(data: CreatePostDTO, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.post.create({ data });
  }

  async update(id: string, data: UpdatePostDTO, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.post.update({ where: { id }, data });
  }

  async deleteById(id: string, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    const result = await client.post.deleteMany({ where: { id } });
    return result.count; // return count so callers can detect already-deleted records
  }
}
```

**Key patterns in every repository method:**
- `tx?: PrismaTransactionClient` parameter on every method — required for transaction support
- `const client = tx ?? prisma` — use transaction client if provided, otherwise global singleton
- `deleteMany` + return count instead of `delete` — lets callers detect if the record already didn't exist (count === 0)

---

## Database Schema

`prisma/schema.prisma` contains 4 base models:

| Model | Purpose |
|---|---|
| `User` | Core user entity; has `role: UserRole` |
| `Token` | Refresh token storage; linked to User |
| `Organisation` | Multi-tenant org entity |
| `OrganizationMember` | Junction table; User ↔ Organisation with `role` |

Run migrations:
```bash
# Development (creates migration file + applies)
npx prisma migrate dev --name describe_the_change

# Production
npx prisma migrate deploy

# Reset local DB (destructive — dev only)
npx prisma migrate reset
```

**Never use `prisma db push` in non-local environments.** It bypasses the migration history.

---

## Cursor Pagination

Use `CursorPaginationHelper` from `src/utils/pagination.ts` for all list endpoints. **Never use offset pagination** (`skip`/`take` with a page number) for large datasets.

```typescript
// In a repository method
async listPosts(opts: { cursor?: string; limit: number }) {
  const { cursor, limit } = opts;
  const decodedCursor = cursor ? CursorPaginationHelper.decodeCursor(cursor) : undefined;

  const rows = await prisma.post.findMany({
    take: limit + 1,           // fetch one extra to detect hasNext
    cursor: decodedCursor ? { id: decodedCursor } : undefined,
    skip: decodedCursor ? 1 : 0,
    orderBy: { createdAt: "desc" },
  });

  return CursorPaginationHelper.buildPage(rows, limit, (row) => row.id);
}
```

**Cursor encoding:** Base64url opaque cursors. `decodeCursor` validates the charset with a regex before decoding — it never throws on invalid input, it returns `undefined`.

---

## Query Best Practices

**Always use `select` to limit returned fields** — avoids accidentally exposing passwords or sensitive data:
```typescript
// Wrong — returns all fields including passwordHash
return client.user.findUnique({ where: { id } });

// Correct
return client.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true, role: true, createdAt: true },
});
```

**Use `include` sparingly** — only when the relation is always needed, not "just in case":
```typescript
// Only include if the caller always needs the org members
return client.organisation.findUnique({
  where: { id },
  include: { members: { select: { userId: true, role: true } } },
});
```

**Use `findUnique`/`findFirst` before updates** when you need to verify the record exists:
```typescript
const post = await client.post.findUnique({ where: { id } });
if (!post) throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
// now update
```

**Use `upsert` for idempotent write operations:**
```typescript
return client.token.upsert({
  where: { id: tokenId },
  create: tokenData,
  update: { expiresAt: newExpiry },
});
```
