import { NextFunction, Request, Response } from "express";

import { API_VERSIONS } from "../config/versions";

/**
 * Factory that returns an Express middleware for a specific API version.
 *
 * Sets the following response headers according to the version's status:
 *
 * All versions:
 *   X-API-Version: v1
 *
 * Deprecated versions (additionally):
 *   Deprecation: <HTTP-date the version was deprecated>    (RFC 8594)
 *   Sunset:      <HTTP-date the version will stop working> (RFC 8594)
 *   Link:        <migration-guide-url>; rel="deprecation"  (RFC 8288)
 *
 * Usage in createApp.ts:
 *   app.use("/v1", apiVersionMiddleware("v1"), router);
 *
 * To introduce v2:
 *   import v2Router from "./routes/v2/indexRoutes";
 *   app.use("/v2", apiVersionMiddleware("v2"), v2Router);
 *
 * When deprecating v1, update API_VERSIONS in src/config/versions.ts:
 *   v1: { status: "deprecated", deprecatedAt: "...", sunsetAt: "...", migrationGuide: "..." }
 * No code changes to this middleware are needed — it re-reads the registry per request.
 */
export function apiVersionMiddleware(version: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const config = API_VERSIONS[version];

    res.set("X-API-Version", version);

    if (
      config &&
      (config.status === "deprecated" || config.status === "sunset")
    ) {
      if (config.deprecatedAt) {
        res.set("Deprecation", config.deprecatedAt);
      }
      if (config.sunsetAt) {
        res.set("Sunset", config.sunsetAt);
      }
      if (config.migrationGuide) {
        res.set("Link", `<${config.migrationGuide}>; rel="deprecation"`);
      }
    }

    next();
  };
}
