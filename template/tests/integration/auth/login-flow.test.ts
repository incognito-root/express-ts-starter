import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../../../src/createApp";
import RedisSingleton from "../../../src/utils/redis/redisClient";
import { loginUser } from "../helpers/auth";
import { seedTestUser, cleanDatabase } from "../helpers/db";
import { flushRedis } from "../helpers/redis";

const TEST_EMAIL = "login-flow@example.com";
const TEST_PASSWORD = "TestPass@123";

describe("Auth: Login Flow", () => {
  let agent: ReturnType<typeof supertest.agent>;
  let csrfToken: string;

  beforeAll(async () => {
    await RedisSingleton.connect();
    agent = supertest.agent(createApp());
    await cleanDatabase();
    await flushRedis();
    await seedTestUser({ email: TEST_EMAIL, password: TEST_PASSWORD });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it("should login with valid credentials and set cookies", async () => {
    const result = await loginUser(agent, TEST_EMAIL, TEST_PASSWORD);
    csrfToken = result.csrfToken;

    expect(result.body).toHaveProperty("status", "success");
    expect((result.body as { data: { userId: string } }).data).toHaveProperty(
      "userId"
    );
  });

  it("should return current user via GET /me", async () => {
    const res = await agent.get("/v1/auth/me").expect(200);

    const data = (res.body as { data: { email: string; name: string } }).data;
    expect(data.email).toBe(TEST_EMAIL);
    expect(data.name).toBe("Test User");
  });

  it("should logout and clear cookies", async () => {
    const res = await agent
      .post("/v1/auth/logout")
      .set("X-CSRF-Token", csrfToken)
      .expect(200);

    expect(res.body).toHaveProperty("status", "success");

    // Verify set-cookie headers are present (cookies being cleared)
    const cookies = res.get("Set-Cookie");
    expect(cookies).toBeDefined();
    const accessCookie = cookies!.find((c: string) =>
      c.startsWith("accessToken=")
    );
    expect(accessCookie).toBeDefined();
  });

  it("should return 401 on GET /me after logout", async () => {
    await agent.get("/v1/auth/me").expect(401);
  });
});
