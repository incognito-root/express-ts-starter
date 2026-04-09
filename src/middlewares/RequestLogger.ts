import { Response, NextFunction } from "express";

import { RequestWithId } from "../types";
import logger from "../utils/logger";

export const requestLogger = (
  req: RequestWithId,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  const requestId = req.id || "unknown";

  logger.info("Incoming request", {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  const originalSend = res.send;
  res.send = function (data): Response {
    const duration = Date.now() - startTime;

    logger.info("Outgoing response", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get("content-length"),
    });

    return originalSend.call(this, data);
  };

  next();
};
