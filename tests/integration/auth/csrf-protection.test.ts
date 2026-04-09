import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../../../src/createApp";
import RedisSingleton from "../../../src/utils/redis/redisClient";
import { getCsrfToken } from "../helpers/csrf";
import { seedTestUser, cleanDatabase } from "../helpers/db";
import { flushRedis } from "../helpers/redis";

const TEST_EMAIL = "csrf-test@example.com";
const TEST_PASSWORD = "TestPass@123";

describe("Auth: CSRF Protection", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await RedisSingleton.connect();
    app = createApp();
    await cleanDatabase();
    await flushRedis();
    await seedTestUser({ email: TEST_EMAIL, password: TEST_PASSWORD });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it("should reject POST /login without CSRF token", async () => {
    const agent = supertest.agent(app);
    const res = await agent
      .post("/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false });

    // csrf-csrf returns 403 for invalid/missing CSRF
    expect(res.status).toBe(403);
  });

  it("should reject POST /login with wrong CSRF token", async () => {
    const agent = supertest.agent(app);
    // Get the CSRF cookie (needed for double-submit) but send a wrong header value
    await agent.get("/v1/auth/csrf-token").expect(200);

    const res = await agent
      .post("/v1/auth/login")
      .set("X-CSRF-Token", "wrong-token-value")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false });

    expect(res.status).toBe(403);
  });

  it("should accept POST /login with valid CSRF token", async () => {
    const agent = supertest.agent(app);
    const { csrfToken } = await getCsrfToken(agent);

    const res = await agent
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false });

    expect(res.status).toBe(200);
  });
});
