import { getEnv } from "./env";

const env = getEnv();

export const isProduction = env.NODE_ENV === "production";

// True when developing against a non-localhost origin (e.g. ngrok/staging).
// Secure cookies require HTTPS, so they must be off for plain localhost HTTP dev.
export const isDevelopmentRemote =
  env.NODE_ENV === "development" &&
  !env.CORS_ORIGINS.some((origin) => origin.includes("localhost"));

// Whether to set the Secure flag on cookies
export const cookieSecure = isProduction || isDevelopmentRemote;

// SameSite for JWT auth cookies — "strict" gives strongest CSRF protection
export const authCookieSameSite: "strict" | "lax" | "none" = isProduction
  ? "strict"
  : "none";

// SameSite for the CSRF token cookie — "lax" allows it to be sent on
// top-level navigations (e.g. OAuth redirects) while still protecting CSRF
export const csrfCookieSameSite: "lax" | "none" = isProduction ? "lax" : "none";

// Optional cookie domain (production only)
export const cookieDomain = isProduction ? env.COOKIE_DOMAIN : undefined;
