// @feature:otel
import { trace } from "@opentelemetry/api";
// @end:otel
import { Format, TransformableInfo } from "logform";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

import { getRequestId } from "./requestContext";

const { combine, timestamp, printf, errors } = format;

// @feature:otel
/**
 * Returns the active OpenTelemetry trace ID for the current async context,
 * or undefined when OTEL is not configured / no active span exists.
 * The zero-value trace ID (32 zeros) is treated as absent.
 */
function getTraceId(): string | undefined {
  try {
    const span = trace.getActiveSpan();
    if (!span) return undefined;
    const traceId = span.spanContext().traceId;
    // Filter out the invalid zero-value trace ID
    return /^[0-9a-f]{32}$/.test(traceId) && traceId !== "0".repeat(32)
      ? traceId
      : undefined;
  } catch {
    return undefined;
  }
}
// @end:otel

const logFormat: Format = printf((info: TransformableInfo) => {
  const { level, message, timestamp: ts, stack } = info;
  const requestId = getRequestId();
  const reqPrefix = requestId ? ` [${requestId}]` : "";
  // @feature:otel
  {
    const traceId = getTraceId();
    const tracePrefix = traceId ? ` trace=${traceId}` : "";
    return `${String(ts)} ${level}${reqPrefix}${tracePrefix}: ${String(stack || message)}`;
  }
  // @end:otel
  // @feature:!otel
  return `${String(ts)} ${level}${reqPrefix}: ${String(stack || message)}`;
  // @end:!otel
});

const logger = createLogger({
  level: "info",
  format: combine(timestamp(), errors({ stack: true }), logFormat),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "14d",
    }),
    new DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: "logs/exceptions-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: "logs/rejections-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

export default logger;
