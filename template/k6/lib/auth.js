/**
 * Reusable auth helpers for k6 scripts.
 *
 * Cookie management is automatic — each k6 VU has its own cookie jar.
 * The _csrf cookie set by GET /v1/auth/csrf-token is sent automatically
 * on all subsequent requests to the same host.
 */

import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./config.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Fetch a CSRF token. Sets the _csrf cookie (auto-stored by k6).
 * @returns {string} csrfToken — pass as X-CSRF-Token header
 */
export function getCsrfToken() {
  const res = http.get(`${BASE_URL}/v1/auth/csrf-token`);
  check(res, {
    "csrf-token 200": (r) => r.status === 200,
    "csrf-token present": (r) => Boolean(r.json("csrfToken")),
  });
  return res.json("csrfToken");
}

/**
 * Log in with email + password.
 * Requires a prior getCsrfToken() call in the same VU iteration.
 * @returns {import("k6/http").RefinedResponse} response
 */
export function login(email, password, csrfToken) {
  return http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { ...JSON_HEADERS, "X-CSRF-Token": csrfToken } }
  );
}

/**
 * Fetch the current authenticated user.
 * Requires an active accessToken cookie (set by login).
 * @returns {import("k6/http").RefinedResponse} response
 */
export function getMe(csrfToken) {
  return http.get(`${BASE_URL}/v1/auth/me`, {
    headers: { "X-CSRF-Token": csrfToken },
  });
}

/**
 * Log out the current VU session.
 * Clears the accessToken + refreshToken cookies on the server side.
 * @returns {import("k6/http").RefinedResponse} response
 */
export function logout(csrfToken) {
  return http.post(`${BASE_URL}/v1/auth/logout`, null, {
    headers: { "X-CSRF-Token": csrfToken },
  });
}
