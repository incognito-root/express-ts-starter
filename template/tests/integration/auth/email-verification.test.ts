import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../../../src/createApp";
import RedisSingleton from "../../../src/utils/redis/redisClient";
import { generateToken, storeToken } from "../../../src/services/authService";
import prisma from "../../../src/utils/prismaClient";
import { getCsrfToken } from "../helpers/csrf";
import { seedTestUser, cleanDatabase } from "../helpers/db";
import { flushRedis } from "../helpers/redis";
import { Role, TokenType } from "../../../generated/prisma/enums";

const TEST_EMAIL = "verify-email@example.com";
const TEST_PASSWORD = "TestPass@123";

describe("Auth: Email Verification", () => {
  let agent: ReturnType<typeof supertest.agent>;
  let userId: string;

  beforeAll(async () => {
    await RedisSingleton.connect();
    agent = supertest.agent(createApp());
    await cleanDatabase();
    await flushRedis();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it("should reject login for unverified user", async () => {
    const user = await seedTestUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      isVerified: false,
    });
    userId = user.id;

    const { csrfToken } = await getCsrfToken(agent);
    const res = await agent
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false })
      .expect(401);

    expect((res.body as { message: string }).message).toMatch(/not verified/i);
  });

  it("should verify email with valid token", async () => {
    // Generate a VERIFY_EMAIL token
    const token = generateToken(
      userId,
      TEST_EMAIL,
      Role.MEMBER,
      "VERIFY_EMAIL",
      false
    );
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await storeToken(token, userId, expiresAt, TokenType.VERIFY_EMAIL);

    const agent2 = supertest.agent(createApp());
    const { csrfToken } = await getCsrfToken(agent2);
    const res = await agent2
      .post("/v1/auth/verify-email")
      .set("X-CSRF-Token", csrfToken)
      .send({ token })
      .expect(200);

    expect((res.body as { message: string }).message).toMatch(
      /verified successfully/i
    );
  });

  it("should have updated user.isVerified in the database", async () => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.isVerified).toBe(true);
  });

  it("should login successfully after email verification", async () => {
    const agent3 = supertest.agent(createApp());
    const { csrfToken } = await getCsrfToken(agent3);
    await agent3
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false })
      .expect(200);
  });

  it("should reject verification for already-verified email", async () => {
    // Generate a new VERIFY_EMAIL token
    const token = generateToken(
      userId,
      TEST_EMAIL,
      Role.MEMBER,
      "VERIFY_EMAIL",
      false
    );
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await storeToken(token, userId, expiresAt, TokenType.VERIFY_EMAIL);

    const agent4 = supertest.agent(createApp());
    const { csrfToken } = await getCsrfToken(agent4);
    await agent4
      .post("/v1/auth/verify-email")
      .set("X-CSRF-Token", csrfToken)
      .send({ token })
      .expect(400);
  });
});
