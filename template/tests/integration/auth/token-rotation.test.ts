import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { CookieAccessInfo } from "cookiejar";
import { createApp } from "../../../src/createApp";
import RedisSingleton from "../../../src/utils/redis/redisClient";
import { getCsrfToken } from "../helpers/csrf";
import { seedTestUser, cleanDatabase } from "../helpers/db";
import { flushRedis } from "../helpers/redis";

const TEST_EMAIL = "token-rotation@example.com";
const TEST_PASSWORD = "TestPass@123";

describe("Auth: Token Rotation", () => {
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

  it("should silently refresh when access token is missing but refresh token is present", async () => {
    // Login to get tokens
    const agent = supertest.agent(app);
    const { csrfToken } = await getCsrfToken(agent);
    await agent
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false })
      .expect(200);

    // Extract the refresh token from the cookie jar
    const rtCookie = agent.jar.getCookie(
      "refreshToken",
      CookieAccessInfo.All
    );
    expect(rtCookie).toBeDefined();

    // Create a fresh agent with ONLY the refresh token (no access token)
    const freshAgent = supertest.agent(app);
    // Need CSRF cookies first
    await getCsrfToken(freshAgent);
    // Inject only the refresh token
    freshAgent.jar.setCookie(
      `refreshToken=${rtCookie!.value}; Path=/; HttpOnly`,
      "127.0.0.1",
      "/"
    );

    // GET /me — should trigger silent refresh via verifyToken middleware
    const res = await freshAgent.get("/v1/auth/me").expect(200);

    // Should have received new cookies (silent refresh sets them)
    const setCookies = res.get("Set-Cookie");
    expect(setCookies).toBeDefined();
    const hasNewAccess = setCookies!.some((c: string) =>
      c.startsWith("accessToken=")
    );
    const hasNewRefresh = setCookies!.some((c: string) =>
      c.startsWith("refreshToken=")
    );
    expect(hasNewAccess).toBe(true);
    expect(hasNewRefresh).toBe(true);
  });

  it("should reject the old refresh token after rotation (token reuse detection)", async () => {
    // Login fresh
    const agent = supertest.agent(app);
    const { csrfToken } = await getCsrfToken(agent);
    await agent
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false })
      .expect(200);

    // Extract the refresh token
    const rtCookie = agent.jar.getCookie(
      "refreshToken",
      CookieAccessInfo.All
    );
    const oldRefreshValue = rtCookie!.value;

    // Trigger a refresh by hitting /me with only the refresh token
    const agent2 = supertest.agent(app);
    await getCsrfToken(agent2);
    agent2.jar.setCookie(
      `refreshToken=${oldRefreshValue}; Path=/; HttpOnly`,
      "127.0.0.1",
      "/"
    );
    await agent2.get("/v1/auth/me").expect(200);

    // Now try to use the OLD refresh token again — should fail (already consumed)
    const agent3 = supertest.agent(app);
    await getCsrfToken(agent3);
    agent3.jar.setCookie(
      `refreshToken=${oldRefreshValue}; Path=/; HttpOnly`,
      "127.0.0.1",
      "/"
    );
    await agent3.get("/v1/auth/me").expect(401);
  });
});
