/**
 * Rate-limit verification test.
 *
 * Fires RATE_LIMIT + 2 consecutive login attempts with wrong credentials
 * from a single VU and asserts that:
 *   - The first RATE_LIMIT attempts receive 401 (reached the server)
 *   - Attempts beyond the threshold receive 429 (rate-limited)
 *
 * Default auth rate limit: 5 requests per 15 minutes (see RATE_LIMIT_MAX_REQUESTS).
 *
 * ⚠️  PREREQUISITE: Rate-limit keys must be clear before running.
 *     If you ran other tests recently, flush Redis first:
 *
 *       redis-cli -p 6380 FLUSHDB   # (test Redis on port 6380)
 *
 *     Or restart the docker-compose test stack:
 *       npm run docker:test:down && npm run docker:test:up
 *
 * Usage:
 *   k6 run \
 *     --env BASE_URL=http://localhost:3001 \
 *     k6/rate-limit.js
 *
 *   # Via npm:
 *   npm run k6:rate-limit
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL } from "./lib/config.js";
import { getCsrfToken } from "./lib/auth.js";

// Must match RATE_LIMIT_MAX_REQUESTS (default: 5).
// Override if your server is configured differently:
//   k6 run --env RATE_LIMIT=10 k6/rate-limit.js
const RATE_LIMIT = parseInt(__ENV.RATE_LIMIT || "5", 10);
// Send RATE_LIMIT + 2 so we see at least two 429 responses.
const TOTAL_ATTEMPTS = RATE_LIMIT + 2;

export const options = {
  vus: 1,
  iterations: 1,
  // 429s are expected — don't count them as failures in this test.
  thresholds: {
    checks: ["rate>0.9"],
  },
};

export default function () {
  let serverReached = 0; // 401 = bad credentials, server responded normally
  let rateLimited = 0;   // 429 = rate limit applied
  let unexpected = 0;    // anything else

  for (let i = 1; i <= TOTAL_ATTEMPTS; i++) {
    // Refresh the CSRF token for each attempt.
    const csrfToken = getCsrfToken();

    const res = http.post(
      `${BASE_URL}/v1/auth/login`,
      JSON.stringify({
        email: "nonexistent@rate-limit-test.example.com",
        password: "wrongpassword123!",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
      }
    );

    if (res.status === 429) {
      rateLimited++;
      console.log(`Attempt ${i}: 429 Rate Limited ✓`);
    } else if (res.status === 400 || res.status === 401) {
      serverReached++;
      console.log(`Attempt ${i}: ${res.status} (reached server)`);
    } else {
      unexpected++;
      console.log(`Attempt ${i}: unexpected status ${res.status}`);
    }

    sleep(0.3);
  }

  console.log(
    `Results: ${serverReached} reached server, ${rateLimited} rate-limited, ${unexpected} unexpected`
  );

  check(
    { serverReached, rateLimited, unexpected },
    {
      [`first ${RATE_LIMIT} attempts reached server`]: (r) =>
        r.serverReached >= RATE_LIMIT,
      [`attempts beyond limit were rate-limited`]: (r) =>
        r.rateLimited >= TOTAL_ATTEMPTS - RATE_LIMIT,
      ["no unexpected responses"]: (r) => r.unexpected === 0,
    }
  );
}
