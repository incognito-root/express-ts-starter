/**
 * Load test — ramping VUs over ~2.5 minutes.
 *
 * Tests the full authenticated request cycle: CSRF → login → me → logout.
 * Measures mid-traffic latency and error rates.
 *
 * ⚠️  RATE LIMIT NOTICE
 * The auth endpoints are protected by a Redis rate limiter (5 req / 15 min
 * per IP by default). When running locally, all VUs share the same source IP
 * and will exhaust the limit quickly. Before running this test:
 *
 *   1. In .env (or your test env), temporarily raise the limit:
 *        RATE_LIMIT_MAX_REQUESTS=10000
 *   2. Or disable the auth rate limiter for the server process:
 *        AUTH_RATE_LIMIT_DISABLED=true  (if wired up in RateLimiter.ts)
 *   3. Or run the test against a staging environment with k6 Cloud,
 *      where VUs originate from many different IPs.
 *
 * Usage:
 *   k6 run \
 *     --env BASE_URL=http://localhost:3001 \
 *     --env TEST_EMAIL=loadtest@example.com \
 *     --env TEST_PASSWORD=LoadTest123! \
 *     k6/load.js
 *
 *   # Via npm:
 *   TEST_EMAIL=... TEST_PASSWORD=... npm run k6:load
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { BASE_URL, TEST_EMAIL, TEST_PASSWORD, THRESHOLDS } from "./lib/config.js";
import { getCsrfToken, login, getMe, logout } from "./lib/auth.js";

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // warm-up: ramp 0→10 VUs
    { duration: "60s", target: 25 },  // sustained: hold at 25 VUs
    { duration: "30s", target: 50 },  // peak: ramp 25→50 VUs
    { duration: "30s", target: 0 },   // ramp-down: 50→0 VUs
  ],
  thresholds: {
    ...THRESHOLDS.load,
    // 429s are expected at high VU counts when rate limits are active;
    // track them separately rather than treating them as failures.
    "http_req_duration{status:429}": [],
  },
};

export default function () {
  group("auth flow", () => {
    // 1. Get CSRF token
    const csrfToken = getCsrfToken();
    sleep(0.1);

    // 2. Login
    const loginRes = login(TEST_EMAIL, TEST_PASSWORD, csrfToken);

    // If rate-limited, back off and skip — do not count as a test failure.
    if (loginRes.status === 429) {
      sleep(2);
      return;
    }

    check(loginRes, {
      "POST /v1/auth/login → 200": (r) => r.status === 200,
      "POST /v1/auth/login → user present": (r) => Boolean(r.json("user")),
    });
    sleep(0.2);

    if (loginRes.status !== 200) {
      sleep(1);
      return;
    }

    // 3. Hit /me a few times to stress the authenticated path
    for (let i = 0; i < 3; i++) {
      const meRes = getMe(csrfToken);
      check(meRes, {
        "GET /v1/auth/me → 200": (r) => r.status === 200,
      });
      sleep(0.2);
    }

    // 4. Logout
    const logoutRes = logout(csrfToken);
    check(logoutRes, {
      "POST /v1/auth/logout → 200": (r) => r.status === 200,
    });
    sleep(0.5);
  });
}
