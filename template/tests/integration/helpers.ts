import supertest from "supertest";
import type { Express } from "express";

import { createApp } from "../../src/createApp";
import { hashPassword } from "../../src/utils/password";
import prisma from "../../src/utils/prismaClient";
import RedisSingleton from "../../src/utils/redis/redisClient";

// ---------------------------------------------------------------------------
// App factory — creates a fresh Express app for the test suite.
// ---------------------------------------------------------------------------
let _app: Express | null = null;

export function getApp(): Express {
  if (!_app) _app = createApp();
  return _app;
}

// ---------------------------------------------------------------------------
// CSRF helper — fetches a CSRF token via the dedicated endpoint.
// The agent automatically persists the `_csrf` httpOnly cookie.
// ---------------------------------------------------------------------------
export async function getCsrfToken(
  agent: ReturnType<typeof supertest.agent>
): Promise<string> {
  const res = await agent.get("/v1/auth/csrf-token").expect(200);
  return res.body.csrfToken as string;
}

// ---------------------------------------------------------------------------
// User seed helper
// ---------------------------------------------------------------------------
export interface SeedUserOptions {
  email?: string;
  password?: string;
  name?: string;
  isVerified?: boolean;
  isActive?: boolean;
}

const DEFAULT_PASSWORD = "TestPassword123!";

export async function seedUser(options: SeedUserOptions = {}) {
  const {
    email = "test@example.com",
    password = DEFAULT_PASSWORD,
    name = "Test User",
    isVerified = true,
    isActive = true,
  } = options;

  const hashedPassword = await hashPassword(password);
  return prisma.user.create({
    data: { email, password: hashedPassword, name, isVerified, isActive },
  });
}

export { DEFAULT_PASSWORD };

// ---------------------------------------------------------------------------
// Database cleanup — truncates all tables in FK-safe order.
// ---------------------------------------------------------------------------
export async function cleanDatabase() {
  await prisma.token.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.user.deleteMany();
}

// ---------------------------------------------------------------------------
// Redis cleanup — flushes the test Redis database.
// ---------------------------------------------------------------------------
export async function cleanRedis() {
  const client = RedisSingleton.getClient();
  await client.flushDb();
}

// ---------------------------------------------------------------------------
// Lifecycle helpers — call these from beforeAll / afterAll.
// ---------------------------------------------------------------------------
export async function connectServices() {
  await RedisSingleton.connect();
}

export async function disconnectServices() {
  await prisma.$disconnect();
  await RedisSingleton.disconnect();
}
