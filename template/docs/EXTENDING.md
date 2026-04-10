# Extending the Template

This guide shows how to add your first domain feature on top of the template infrastructure.

---

## Overview

The template follows a strict 4-layer architecture enforced by ESLint:

```
Controller → Service → Repository → Prisma
```

- **Controllers** handle HTTP request/response only
- **Services** contain all business logic
- **Repositories** are the only layer that touches Prisma
- **Routes** wire controllers to Express + middleware

---

## Step 1: Add a Prisma Model

In `prisma/schema.prisma`, add your model:

```prisma
model Post {
  id          String   @id @default(cuid())
  title       String
  content     String
  authorId    String
  publishedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  author User @relation(fields: [authorId], references: [id])
}
```

Add the relation back on User:
```prisma
model User {
  // ... existing fields
  posts Post[]
}
```

Run the migration:
```bash
npx prisma migrate dev --name add_post_model
```

---

## Step 2: Add Repository Types

Create `src/types/repository/post.ts`:

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

Export from `src/types/index.ts`:
```typescript
export * from "./repository/post";
```

---

## Step 3: Create a Repository

Create `src/repositories/PostRepository.ts`:

```typescript
import { Post } from "../../generated/prisma";
import { PrismaTransactionClient } from "../types";
import { CreatePostDTO, UpdatePostDTO } from "../types/repository/post";
import prisma from "../utils/prismaClient";
import { BaseRepository } from "./BaseRepository";

export class PostRepository extends BaseRepository<Post> {
  async findById(id: string, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.post.findUnique({ where: { id } });
  }

  async findByAuthor(authorId: string, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.post.findMany({ where: { authorId }, orderBy: { createdAt: "desc" } });
  }

  async create(data: CreatePostDTO, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.post.create({ data });
  }

  async update(id: string, data: UpdatePostDTO, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.post.update({ where: { id }, data });
  }

  async delete(id: string, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.post.delete({ where: { id } });
  }
}
```

---

## Step 4: Create a Service

Create `src/services/postService.ts`:

```typescript
import { ERROR_MESSAGES } from "../constants/errorMessages";
import { ForbiddenError } from "../errors/ForbiddenError";
import { NotFoundError } from "../errors/NotFoundError";
import { PostRepository } from "../repositories/PostRepository";
import { CreatePostDTO } from "../types/repository/post";

const postRepository = new PostRepository();

export const createPost = async (data: CreatePostDTO) => {
  return postRepository.create(data);
};

export const getPostById = async (id: string) => {
  const post = await postRepository.findById(id);
  if (!post) throw new NotFoundError("Post not found");
  return post;
};

export const deletePost = async (id: string, requestingUserId: string) => {
  const post = await postRepository.findById(id);
  if (!post) throw new NotFoundError("Post not found");
  if (post.authorId !== requestingUserId)
    throw new ForbiddenError("You do not own this post");
  return postRepository.delete(id);
};
```

---

## Step 5: Create a Controller

Create `src/controllers/postController.ts`:

```typescript
import { Response, NextFunction } from "express";
import * as postService from "../services/postService";
import { TypedRequestWithUser, TypedRequest } from "../types";
import successResponse from "../utils/http/response";

export const createPost = async (
  req: TypedRequestWithUser<{ title: string; content: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const post = await postService.createPost({
      title: req.body.title,
      content: req.body.content,
      authorId: req.user.id,
    });
    successResponse(res, post, "Post created", 201);
  } catch (error) {
    next(error);
  }
};
```

---

## Step 6: Create a Route

Create `src/routes/postRoutes.ts`:

```typescript
import express, { RequestHandler } from "express";
import * as postController from "../controllers/postController";
import { verifyToken, checkUserStatus } from "../middlewares/Auth";
import { csrfProtection } from "../middlewares/Csrf";

const router = express.Router();

router.post(
  "/",
  verifyToken as RequestHandler,
  checkUserStatus as RequestHandler,
  csrfProtection,
  postController.createPost as RequestHandler
);

export default router;
```

Mount it in `src/routes/indexRoutes.ts`:

```typescript
import postRoutes from "./postRoutes";
router.use("/posts", postRoutes);
```

---

## Adding Error Messages

Add domain-specific error messages to `src/constants/errorMessages.ts`:

```typescript
// Posts
POST_NOT_FOUND: "Post not found",
POST_ACCESS_DENIED: "You do not have permission to modify this post",
```

---

## Adding WebSocket Events

See `src/websocket/handlers/EXTENDING.md` for a complete guide on adding real-time events.

---

## Transactions

Use `withTransaction` from `src/repositories/BaseRepository.ts` when multiple writes must be atomic:

```typescript
import { withTransaction } from "../repositories/BaseRepository";

await withTransaction(async (tx) => {
  const post = await postRepository.create(data, tx);
  await notificationRepository.create({ userId: data.authorId, postId: post.id }, tx);
  return post;
});
```
