/**
 * API version registry.
 *
 * Add a new entry whenever a version is introduced, deprecated, or sunsetted.
 * The `apiVersionMiddleware` in src/middlewares/ApiVersion.ts reads this
 * registry at request time to set the correct response headers.
 *
 * Version lifecycle:
 *   "current"    → stable; X-API-Version header only
 *   "deprecated" → Deprecation + Sunset + Link headers added automatically
 *   "sunset"     → treated as deprecated; the version should have been removed
 *
 * Date format: RFC 7231 HTTP-date   e.g. "Sat, 01 Jan 2026 00:00:00 GMT"
 * (Use `new Date(...).toUTCString()` to generate one)
 */

export type VersionStatus = "current" | "deprecated" | "sunset";

export interface VersionConfig {
  /** URL path segment, e.g. "v1" */
  version: string;
  status: VersionStatus;
  /**
   * RFC 8594 Deprecation header value — the date the version was deprecated.
   * Required when status is "deprecated" or "sunset".
   * Format: RFC 7231 HTTP-date  e.g. "Sat, 01 Jan 2026 00:00:00 GMT"
   */
  deprecatedAt?: string;
  /**
   * RFC 8594 Sunset header value — the date the version will stop working.
   * Clients should migrate before this date.
   * Format: RFC 7231 HTTP-date  e.g. "Sat, 01 Jul 2026 00:00:00 GMT"
   */
  sunsetAt?: string;
  /**
   * URL of the migration guide for this version.
   * Sent as a `Link: <url>; rel="deprecation"` header.
   */
  migrationGuide?: string;
}

/**
 * Registry of all API versions produced by this service.
 *
 * Example of a future deprecation entry for v1 (once v2 ships):
 *
 *   v1: {
 *     version: "v1",
 *     status: "deprecated",
 *     deprecatedAt: "Sat, 01 Feb 2026 00:00:00 GMT",
 *     sunsetAt:     "Sat, 01 Aug 2026 00:00:00 GMT",
 *     migrationGuide: "https://docs.example.com/migrate-v1-to-v2",
 *   },
 */
export const API_VERSIONS: Record<string, VersionConfig> = {
  v1: {
    version: "v1",
    status: "current",
  },
};

/** The version that new clients should target. */
export const CURRENT_VERSION = "v1" as const;
