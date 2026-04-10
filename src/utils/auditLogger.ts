import { createLogger, format } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

import { getRequestId } from "./requestContext";

const auditLog = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new DailyRotateFile({
      filename: "logs/audit-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "90d",
    }),
  ],
});

export const audit = (event: string, data: Record<string, unknown>): void => {
  auditLog.info(event, {
    ...data,
    requestId: getRequestId(),
    timestamp: new Date().toISOString(),
  });
};
