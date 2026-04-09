import { Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

import { getEnv } from "../config/env";
import { AppError } from "../errors/AppError";
import { BadRequestError } from "../errors/BadRequestError";
import { RequestWithId } from "../types";
import { sanitizeData } from "../utils/dataSanitizer";
import logger from "../utils/logger";

const ERROR_TYPES: Record<string, number> = {
  BadRequestError: 400,
  UnauthorizedError: 401,
  ForbiddenError: 403,
  NotFoundError: 404,
  ValidationError: 422,
  RateLimitError: 429,
  DatabaseError: 500,
  ServiceUnavailableError: 503,
};

const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "authorization",
  "apiKey",
  "credit_card",
  "ssn",
  "passport",
];

const errorHandler = (
  err: Error,
  req: RequestWithId,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  const env = getEnv();
  const isDevelopment = env.NODE_ENV === "development";
  const isTest = env.NODE_ENV === "test";

  const errorId = uuidv4();

  res.setHeader("X-Error-ID", errorId);

  const isOperationalError = err instanceof AppError;
  const errorName = err.constructor.name;
  const statusCode = isOperationalError
    ? err.statusCode
    : ERROR_TYPES[errorName] || 500;

  const logLevel: "error" | "warn" | "info" =
    statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

  const userMessage =
    isOperationalError || statusCode < 500
      ? err.message
      : "An unexpected error occurred. Our team has been notified.";

  const sanitizedBody = sanitizeData(req.body, SENSITIVE_FIELDS) as Record<
    string,
    unknown
  >;
  const sanitizedHeaders = sanitizeData(
    req.headers,
    SENSITIVE_FIELDS
  ) as Record<string, unknown>;
  const sanitizedQuery = sanitizeData(req.query, SENSITIVE_FIELDS) as Record<
    string,
    unknown
  >;
  const sanitizedParams = sanitizeData(req.params, SENSITIVE_FIELDS) as Record<
    string,
    unknown
  >;

  const logMeta = {
    errorId,
    statusCode,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      isOperational: isOperationalError,
    },
    request: {
      url: req.originalUrl,
      method: req.method,
      headers: isDevelopment ? sanitizedHeaders : undefined,
      ip: req.ip,
      userId: (req as RequestWithId & { user?: { id: string } }).user?.id,
      requestId: req.id || errorId,
      body: sanitizedBody,
      query: sanitizedQuery,
      params: sanitizedParams,
    },
    timestamp: new Date().toISOString(),
    appVersion: env.APP_VERSION,
  };

  if (isDevelopment && !isTest) {
    logger.error(`🚨 Error [${errorId}] - ${err.name}: ${err.message}`, {
      status: statusCode,
      stack: err.stack,
      requestDetails: {
        method: req.method,
        url: req.originalUrl,
        userId:
          (req as RequestWithId & { user?: { id: string } }).user?.id ||
          "unauthenticated",
        body: sanitizedBody,
        query: sanitizedQuery,
        params: sanitizedParams,
      },
    });
  }

  logger[logLevel](
    `[${errorId}] ${err.name}: ${err.message}`,
    isDevelopment
      ? logMeta
      : {
          ...logMeta,
          request: {
            ...logMeta.request,
            headers: undefined,
            body:
              sanitizedBody && Object.keys(sanitizedBody).length > 0
                ? "(redacted)"
                : undefined,
            query:
              sanitizedQuery && Object.keys(sanitizedQuery).length > 0
                ? "(redacted)"
                : undefined,
          },
        }
  );

  const response: {
    status: string;
    message: string;
    errorId: string;
    code?: string;
    details?: Array<{ field: string; message: string }>;
    stack?: string;
    errorName?: string;
    errorDetails?: Record<string, unknown>;
  } = {
    status: "error",
    message: userMessage,
    errorId: errorId,
    // Only expose the class name for operational errors; non-operational 500s
    // get a generic code so internal implementation details aren't leaked.
    code: isOperationalError ? errorName : "INTERNAL_ERROR",
  };

  if (err instanceof BadRequestError && err.errors) {
    response.details = err.errors;
  }

  if (isDevelopment) {
    response.stack = err.stack;
    response.errorName = err.name;
    response.errorDetails = {
      name: err.name,
      message: err.message,
      isOperational: isOperationalError,
    };
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
