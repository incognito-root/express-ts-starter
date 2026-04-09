import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import supertest from "supertest";

import {
  getApp,
  getCsrfToken,
  seedUser,
  DEFAULT_PASSWORD,
  cleanDatabase,
  cleanRedis,
  connectServices,
  disconnectServices,
} from "./helpers";

// ---------------------------------------------------------------------------
// Suite-wide setup — one Express app, one supertest agent per top-level
// describe, services connected once.
// ---------------------------------------------------------------------------
let agent: ReturnType<typeof supertest.agent>;

beforeAll(async () => {
  await connectServices();
  agent = supertest.agent(getApp());
});

beforeEach(async () => {
  await cleanDatabase();
  await cleanRedis();
  // Create a fresh agent so cookies don't leak between tests.
  agent = supertest.agent(getApp());
});

afterAll(async () => {
  await cleanDatabase();
  await cleanRedis();
  await disconnectServices();
});

// ---------------------------------------------------------------------------
// Helper — login flow (CSRF + POST /login) returns the supertest response.
// ---------------------------------------------------------------------------
async function loginAs(
  ag: ReturnType<typeof supertest.agent>,
  email: string,
  password: string,
  rememberMe = false
) {
  const csrfToken = await getCsrfToken(ag);
  return ag
    .post("/v1/auth/login")
    .set("X-CSRF-Token", csrfToken)
    .send({ email, password, rememberMe });
}

// =========================================================================
// LOGIN
// =========================================================================
describe("POST /v1/auth/login", () => {
  it("returns 200 and sets auth cookies on valid credentials", async () => {
    await seedUser();

    const res = await loginAs(agent, "test@example.com", DEFAULT_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.userId).toBeDefined();
    expect(res.body.message).toBe("Logged in successfully.");

    // Verify httpOnly auth cookies were set
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c: string) => c.startsWith("accessToken="))).toBe(
      true
    );
    expect(cookies.some((c: string) => c.startsWith("refreshToken="))).toBe(
      true
    );
  });

  it("returns 401 on wrong password", async () => {
    await seedUser();

    const res = await loginAs(agent, "test@example.com", "WrongPassword!");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
  });

  it("returns 401 for unverified email", async () => {
    await seedUser({ isVerified: false });

    const res = await loginAs(agent, "test@example.com", DEFAULT_PASSWORD);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not verified/i);
  });

  it("returns 401 for deactivated account", async () => {
    await seedUser({ isActive: false });

    const res = await loginAs(agent, "test@example.com", DEFAULT_PASSWORD);

    expect(res.status).toBe(401);
  });
});

// =========================================================================
// GET /me
// =========================================================================
describe("GET /v1/auth/me", () => {
  it("returns user data when authenticated", async () => {
    const user = await seedUser();
    await loginAs(agent, "test@example.com", DEFAULT_PASSWORD);

    const res = await agent.get("/v1/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("test@example.com");
    expect(res.body.data.name).toBe("Test User");
    expect(res.body.data.id).toBe(user.id);
    // Password should never be exposed
    expect(res.body.data.password).toBeUndefined();
  });

  it("returns 401 when not authenticated", async () => {
    const freshAgent = supertest.agent(getApp());
    const res = await freshAgent.get("/v1/auth/me");

    expect(res.status).toBe(401);
  });
});

// =========================================================================
// LOGOUT
// =========================================================================
describe("POST /v1/auth/logout", () => {
  it("clears auth cookies and returns 200", async () => {
    await seedUser();
    await loginAs(agent, "test@example.com", DEFAULT_PASSWORD);

    const csrfToken = await getCsrfToken(agent);
    const res = await agent
      .post("/v1/auth/logout")
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");

    // Cookies should be cleared (set to empty with past expiry)
    const cookies = res.headers["set-cookie"] as unknown as string[];
    const accessClear = cookies?.find((c: string) =>
      c.startsWith("accessToken=")
    );
    expect(accessClear).toContain("accessToken=;");
  });

  it("blacklists the access token so /me returns 401", async () => {
    await seedUser();
    await loginAs(agent, "test@example.com", DEFAULT_PASSWORD);

    // Logout using the same agent (cookies are still set)
    const csrfToken = await getCsrfToken(agent);
    await agent.post("/v1/auth/logout").set("X-CSRF-Token", csrfToken);

    // After logout, /me should fail because:
    // 1. Cookies were cleared by the logout response, AND
    // 2. The access token JTI is blacklisted in Redis
    const meRes = await agent.get("/v1/auth/me");
    expect(meRes.status).toBe(401);
  });
});

// =========================================================================
// CSRF PROTECTION
// =========================================================================
describe("CSRF protection", () => {
  it("rejects POST /login without a CSRF token", async () => {
    await seedUser();

    // POST directly without fetching a CSRF token first
    const res = await agent
      .post("/v1/auth/login")
      .send({
        email: "test@example.com",
        password: DEFAULT_PASSWORD,
        rememberMe: false,
      });

    // csrf-csrf returns 403 (Forbidden) when token is missing/invalid
    expect(res.status).toBe(403);
  });
});

// =========================================================================
// HEALTH CHECK (smoke test)
// =========================================================================
describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await agent.get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });
});
