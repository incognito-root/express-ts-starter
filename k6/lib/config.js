/**
 * Shared configuration for k6 load test scripts.
 *
 * Override defaults via environment variables:
 *   k6 run --env BASE_URL=https://staging.example.com smoke.js
 *   k6 run --env TEST_EMAIL=myuser@example.com --env TEST_PASSWORD=secret smoke.js
 */

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

export const TEST_EMAIL = __ENV.TEST_EMAIL || "loadtest@example.com";
export const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadTest123!";

/**
 * Threshold presets.
 *
 * smoke  — tight; 1 VU verifying the server works correctly.
 * load   — looser; many VUs under sustained pressure.
 */
export const THRESHOLDS = {
  smoke: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  load: {
    http_req_duration: ["p(95)<1000", "p(99)<2000"],
    http_req_failed: ["rate<0.05"],
    checks: ["rate>0.95"],
  },
};
