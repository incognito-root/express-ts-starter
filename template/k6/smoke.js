/**
 * Smoke test — 1 VU × 30 s.
 *
 * Validates that every public endpoint responds correctly and within
 * tight latency thresholds. Run locally after seeding a test user:
 *
 *   k6 run \
 *     --env BASE_URL=http://localhost:3001 \
 *     --env TEST_EMAIL=loadtest@example.com \
 *     --env TEST_PASSWORD=LoadTest123! \
 *     k6/smoke.js
 *
 * Or via npm (requires k6 installed):
 *   TEST_EMAIL=... TEST_PASSWORD=... npm run k6:smoke
 *
 * Or via Docker (no k6 install needed):
 *   TEST_EMAIL=... TEST_PASSWORD=... npm run k6:smoke:docker
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { BASE_URL, TEST_EMAIL, TEST_PASSWORD, THRESHOLDS } from "./lib/config.js";
import { getCsrfToken, login, getMe, logout } from "./lib/auth.js";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: THRESHOLDS.smoke,
};

export default function () {
  // ── Health ──────────────────────────────────────────────────────────────
  group("health", () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      "GET /health → 200": (r) => r.status === 200,
      "GET /health → status present": (r) => Boolean(r.json("status")),
    });
    sleep(0.3);

    const ready = http.get(`${BASE_URL}/ready`);
    check(ready, {
      "GET /ready → 200": (r) => r.status === 200,
    });
    sleep(0.3);
  });

  // ── Auth flow ────────────────────────────────────────────────────────────
  group("auth flow", () => {
    // 1. CSRF token
    const csrfToken = getCsrfToken();
    sleep(0.1);

    // 2. Login
    const loginRes = login(TEST_EMAIL, TEST_PASSWORD, csrfToken);
    const loginOk = check(loginRes, {
      "POST /v1/auth/login → 200": (r) => r.status === 200,
      "POST /v1/auth/login → user present": (r) => Boolean(r.json("user")),
    });
    sleep(0.2);

    // Skip authenticated steps if login failed (e.g. user not seeded yet)
    if (!loginOk) {
      return;
    }

    // 3. Get current user
    const meRes = getMe(csrfToken);
    check(meRes, {
      "GET /v1/auth/me → 200": (r) => r.status === 200,
      "GET /v1/auth/me → email present": (r) => Boolean(r.json("email")),
    });
    sleep(0.2);

    // 4. Logout
    const logoutRes = logout(csrfToken);
    check(logoutRes, {
      "POST /v1/auth/logout → 200": (r) => r.status === 200,
    });
    sleep(0.5);
  });
}
