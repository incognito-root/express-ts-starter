import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../../../src/createApp";
import RedisSingleton from "../../../src/utils/redis/redisClient";
import { getCsrfToken } from "../helpers/csrf";
import { seedTestUser, cleanDatabase } from "../helpers/db";
import { flushRedis, resetRateLimits } from "../helpers/redis";

const TEST_EMAIL = "ratelimit@example.com";
const TEST_PASSWORD = "TestPass@123";

describe("Auth: Rate Limiting", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await RedisSingleton.connect();
    app = createApp();
    await cleanDatabase();
    await flushRedis();
    await seedTestUser({ email: TEST_EMAIL, password: TEST_PASSWORD });
  });

  beforeEach(async () => {
    await resetRateLimits();
  });

  afterAll(async () => {
    await resetRateLimits();
    await cleanDatabase();
  });

  it("should return 429 after exceeding auth rate limit (5 attempts)", async () => {
    // The authRateLimiter allows 5 requests per 15 minutes.
    // We use different agents but they all resolve to the same IP in supertest.

    for (let i = 0; i < 5; i++) {
      const agent = supertest.agent(app);
      const { csrfToken } = await getCsrfToken(agent);
      await agent
        .post("/v1/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: TEST_EMAIL,
          password: "WrongPass@" + i,
          rememberMe: false,
        });
      // Don't assert status here — could be 401 or 200, we just want to consume rate limit tokens
    }

    // 6th attempt should be rate limited
    const agent = supertest.agent(app);
    const { csrfToken } = await getCsrfToken(agent);
    const res = await agent
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false });

    expect(res.status).toBe(429);
    expect(res.headers["x-ratelimit-remaining"]).toBe("0");
    expect(res.headers["retry-after"]).toBeDefined();
  });
});
