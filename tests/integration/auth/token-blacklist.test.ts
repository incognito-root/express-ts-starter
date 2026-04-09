import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import supertest from "supertest";
import { CookieAccessInfo } from "cookiejar";
import { createApp } from "../../../src/createApp";
import RedisSingleton from "../../../src/utils/redis/redisClient";
import { getCsrfToken } from "../helpers/csrf";
import { seedTestUser, cleanDatabase } from "../helpers/db";
import { flushRedis } from "../helpers/redis";

const TEST_EMAIL = "blacklist@example.com";
const TEST_PASSWORD = "TestPass@123";

describe("Auth: Token Blacklist", () => {
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

  it("should blacklist the access token after logout", async () => {
    // Login
    const agent = supertest.agent(app);
    const { csrfToken } = await getCsrfToken(agent);
    await agent
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false })
      .expect(200);

    // Extract the access token from the cookie jar
    const atCookie = agent.jar.getCookie(
      "accessToken",
      CookieAccessInfo.All
    );
    expect(atCookie).toBeDefined();
    const accessTokenValue = atCookie!.value;

    // Decode to get jti
    const decoded = jwt.decode(accessTokenValue) as { jti?: string } | null;
    expect(decoded?.jti).toBeDefined();

    // Logout
    await agent
      .post("/v1/auth/logout")
      .set("X-CSRF-Token", csrfToken)
      .expect(200);

    // Verify the JTI is blacklisted in Redis
    const redisClient = RedisSingleton.getClient();
    const blacklisted = await redisClient.get(
      `blacklist:jti:${decoded!.jti!}`
    );
    expect(blacklisted).not.toBeNull();
  });

  it("should reject a blacklisted access token on /me", async () => {
    // Login fresh
    const agent = supertest.agent(app);
    const { csrfToken } = await getCsrfToken(agent);
    await agent
      .post("/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, rememberMe: false })
      .expect(200);

    // Extract access token
    const atCookie = agent.jar.getCookie(
      "accessToken",
      CookieAccessInfo.All
    );
    const accessTokenValue = atCookie!.value;

    // Logout (blacklists the token)
    await agent
      .post("/v1/auth/logout")
      .set("X-CSRF-Token", csrfToken)
      .expect(200);

    // Try to use the old access token directly on a new agent
    const agent2 = supertest.agent(app);
    agent2.jar.setCookie(
      `accessToken=${accessTokenValue}; Path=/; HttpOnly`,
      "127.0.0.1",
      "/"
    );
    await agent2.get("/v1/auth/me").expect(401);
  });
});
