import { NextFunction, Request, Response } from "express";

import {
  httpRequestDurationMs,
  httpRequestsTotal,
} from "../utils/metrics";

/**
 * Records HTTP request count and duration per method / route / status.
 *
 * Route labels are read from req.route.path (set by Express after routing)
 * which contains the parameterized pattern (e.g. /v1/auth/:id) rather than
 * the raw URL. This prevents high-cardinality label explosions from path
 * parameters. Falls back to req.path for unmatched routes (404s, health).
 *
 * Place after requestIdMiddleware and before any route handlers in createApp.ts.
 * Label population on the Prometheus side happens on res.finish, after the
 * route handler has run and req.route is populated.
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startMs = Date.now();

  res.on("finish", () => {
    const method = req.method;
    const route = (req.route?.path as string | undefined) ?? req.path;
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationMs.observe(
      { method, route, status_code: statusCode },
      Date.now() - startMs
    );
  });

  next();
}
