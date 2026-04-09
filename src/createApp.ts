import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";

import { getEnv } from "./config/env";
import { setupSwagger } from "./config/swagger";
import { healthCheck, readinessCheck } from "./controllers/healthController";
import errorHandler from "./middlewares/ErrorHandler";
import { apiVersionMiddleware } from "./middlewares/ApiVersion";
import { metricsMiddleware } from "./middlewares/Metrics";
import { requestIdMiddleware } from "./middlewares/RequestId";
import { requestLogger } from "./middlewares/RequestLogger";
import router from "./routes/indexRoutes";
import { RequestWithId } from "./types";
import logger from "./utils/logger";
import { register } from "./utils/metrics";
import { sanitizeJsonInput } from "./utils/sanitize";

export function createApp() {
  const env = getEnv();
  const app = express();

  // Trust first proxy hop — required for correct req.ip behind nginx/load balancer
  app.set("trust proxy", 1);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // Request ID tracking
  app.use(requestIdMiddleware);

  // Prometheus metrics collection (all requests, including health)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(metricsMiddleware as any);

  // Request logging
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(requestLogger as any);

  // Response compression
  app.use(compression());

  // Body parsing
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // XSS sanitization of request body
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.body) req.body = sanitizeJsonInput(req.body);
    next();
  });

  // CORS configuration
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Content-Type",
        "Accept",
        "Authorization",
        "X-Request-ID",
        "X-CSRF-Token",
      ],
      // Expose custom response headers so browser JS can read them
      exposedHeaders: [
        "X-API-Version",
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Deprecation",
        "Sunset",
        "Link",
      ],
    })
  );

  // Health check endpoints (before other routes)
  app.get("/health", healthCheck);
  app.get("/ready", readinessCheck);

  // Prometheus metrics endpoint.
  // If HEALTH_API_KEY is set, requires Authorization: Bearer <key>.
  app.get("/metrics", async (req: Request, res: Response) => {
    const apiKey = env.HEALTH_API_KEY;
    if (apiKey) {
      const auth = req.headers.authorization;
      const token = auth?.startsWith("Bearer ")
        ? auth.slice(7)
        : (req.query.token as string | undefined);
      if (token !== apiKey) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
    }
    const metrics = await register.metrics();
    res.set("Content-Type", register.contentType);
    res.end(metrics);
  });

  // API documentation (development only)
  if (env.NODE_ENV !== "production") {
    setupSwagger(app);
  }

  // API routes — apiVersionMiddleware sets X-API-Version (+ Deprecation/Sunset when applicable)
  app.use("/v1", apiVersionMiddleware("v1"), router);

  // Catch-all for undefined routes
  app.use((req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const requestId: string = (req as RequestWithId).id;

    logger.warn("Route not found", {
      method: req.method,
      path: req.path,
      ip: req.ip,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      requestId,
    });
    res.status(404).json({
      success: false,
      message: "Route not found",
    });
  });

  // Global error handler (must be last)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(errorHandler as any);

  return app;
}
