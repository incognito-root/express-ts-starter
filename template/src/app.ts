import http from "http";

import dotenv from "dotenv";

dotenv.config();

// Tracing MUST be imported after dotenv.config() (so OTEL env vars are loaded)
// and before createApp (so express is instrumented before it is required).

import { validateEnv, getEnv } from "./config/env";
import { createApp } from "./createApp";
// @feature:bullmq
import { closeQueues } from "./queues/emailQueue";
// @end:bullmq
// @feature:otel
import { otelShutdown } from "./tracing";
// @end:otel
import { EmailService } from "./utils/emails/emailService";
import { NodemailerProvider } from "./utils/emails/nodemailerProvider";
import logger from "./utils/logger";
// eslint-disable-next-line no-restricted-imports -- app.ts uses prisma directly for graceful shutdown only
import prisma from "./utils/prismaClient";
import RedisSingleton from "./utils/redis/redisClient";
// @feature:websocket
import {
  initializeWebSocketServer,
  shutdownWebSocketServer,
} from "./websocket";
// @end:websocket

validateEnv();
const env = getEnv();

process.on("uncaughtException", (error) => {
  console.error("FATAL: Uncaught Exception:", error.message);
  console.error(error.stack);
  logger.error("Uncaught Exception:", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  console.error("FATAL: Unhandled Rejection:", message);
  if (stack) console.error(stack);
  logger.error("Unhandled Rejection:", { message, stack });
  process.exit(1);
});

const app = createApp();
const server = http.createServer(app);

// Server timeout configuration
server.timeout = 30000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) {
    logger.info(`Already shutting down, ignoring ${signal}`);
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    logger.error("Forcing exit after timeout");
    process.exit(1);
  }, 10000);

  void (async () => {
    try {
      // @feature:websocket
      await shutdownWebSocketServer();
      logger.info("WebSocket server closed");
      // @end:websocket

      // @feature:bullmq
      await closeQueues();
      logger.info("Email queue closed");
      // @end:bullmq

      await RedisSingleton.disconnect();
      logger.info("Redis disconnected");

      await new Promise<void>((resolve) => {
        server.close(() => {
          logger.info("Server closed");
          resolve();
        });
      });

      await prisma.$disconnect();
      logger.info("Prisma disconnected");

      // @feature:otel
      await otelShutdown();
      logger.info("OpenTelemetry flushed");
      // @end:otel

      clearTimeout(forceExitTimer);
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  })();
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

function initializeEmailService() {
  try {
    const emailProvider = new NodemailerProvider();
    const emailService = EmailService.getInstance(emailProvider);
    app.set("emailService", emailService);
    logger.info("Email service initialized");
    return true;
  } catch (error) {
    logger.error("Email service initialization failed:", error);
    return false;
  }
}

async function initializeRedis() {
  try {
    await RedisSingleton.connect();
    logger.info("Redis connected successfully");
    return true;
  } catch (error) {
    logger.warn("Redis connection failed:", error);
    logger.info("Continuing without Redis - some features may not work");
    return false;
  }
}

async function startServer() {
  try {
    logger.info("Starting server initialization...");
    const emailServiceOk = initializeEmailService();
    const redisOk = await initializeRedis();

    const PORT = env.PORT;

    // @feature:websocket
    let wsOk = false;
    if (redisOk) {
      try {
        initializeWebSocketServer(server);
        wsOk = true;
        logger.info("WebSocket server initialized");
      } catch (error) {
        logger.warn("WebSocket server initialization failed:", error);
      }
    } else {
      logger.warn("WebSocket server not initialized - Redis is required");
    }
    // @end:websocket

    server.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      if (env.NODE_ENV !== "production") {
        logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
      }
      // @feature:websocket
      logger.info(
        `Services status: Email=${emailServiceOk}, Redis=${redisOk}, WebSocket=${wsOk}`
      );
      // @end:websocket
      // @feature:!websocket
      logger.info(
        `Services status: Email=${emailServiceOk}, Redis=${redisOk}`
      );
      // @end:!websocket
      logger.info(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error(
      "Failed to start server:",
      error instanceof Error ? error.message : error
    );
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

void startServer();
