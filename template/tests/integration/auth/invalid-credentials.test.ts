import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../../../src/createApp";
import RedisSingleton from "../../../src/utils/redis/redisClient";
import { getCsrfToken } from "../helpers/csrf";
import { seedTestUser, cleanDatabase } from "../helpers/db";
import { flushRedis } from "../helpers/redis";

const TEST_PASSWORD = "TestPass@123";

describe("Auth: Invalid Credentials", () => {
  let agent: ReturnType<typeof supertest.agent>;

  beforeAll(async () => {
    await RedisSingleton.connect();
    agent = supertest.agent(createApp());
    await cleanDatabase();
    await flushRedis();
    await seedTestUser({
      email: "valid@example.com",
      password: TEST_PASSWORD,
    });
    await seedTestUser({
      email: "inactive@example.com",
      password: TEST_PASSWORD,
      isActive: false,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it("should return 401 for wrong password", async () => {
    const { csrfToken } = await getCsrfToken(agent);
    await agent
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "valid@example.com", password: "WrongPass@456", rememberMe: false })
      .expect(401);
  });

  it("should return 401 for non-existent email", async () => {
    // New agent to avoid rate limit from previous test
    const agent2 = supertest.agent(createApp());
    const { csrfToken } = await getCsrfToken(agent2);
    await agent2
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({
        email: "nonexistent@example.com",
        password: TEST_PASSWORD,
        rememberMe: false,
      })
      .expect(401);
  });

  it("should return 400 for missing email field", async () => {
    const agent3 = supertest.agent(createApp());
    const { csrfToken } = await getCsrfToken(agent3);
    await agent3
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ password: TEST_PASSWORD, rememberMe: false })
      .expect(400);
  });

  it("should return 401 for inactive user", async () => {
    const agent4 = supertest.agent(createApp());
    const { csrfToken } = await getCsrfToken(agent4);
    await agent4
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({
        email: "inactive@example.com",
        password: TEST_PASSWORD,
        rememberMe: false,
      })
      .expect(401);
  });
});
