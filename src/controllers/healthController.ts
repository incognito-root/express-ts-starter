import { Request, Response } from "express";

import { getEnv } from "../config/env";
import { emailQueue } from "../queues/emailQueue";
import { HealthStatus, ServiceHealth } from "../types/api/health";
import logger from "../utils/logger";
// eslint-disable-next-line no-restricted-imports -- Health check requires direct $queryRaw access
import prisma from "../utils/prismaClient";
import RedisSingleton from "../utils/redis/redisClient";

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "up",
      responseTime: Date.now() - start,
    };
  } catch (error) {
    logger.error("Database health check failed", { error });
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Unknown error",
      responseTime: Date.now() - start,
    };
  }
}

async function checkRedis(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const redis = RedisSingleton.getClient();
    await redis.ping();
    return {
      status: "up",
      responseTime: Date.now() - start,
    };
  } catch (error) {
    logger.error("Redis health check failed", { error });
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Unknown error",
      responseTime: Date.now() - start,
    };
  }
}

function checkEmail(): ServiceHealth {
  try {
    const env = getEnv();
    if (env.EMAIL_HOST && env.EMAIL_USER) {
      return { status: "up" };
    }
    return {
      status: "down",
      message: "Email configuration missing",
    };
  } catch (error) {
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkQueue(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const jobCounts = await emailQueue.getJobCounts();
    return {
      status: "up",
      responseTime: Date.now() - start,
      message: `Active: ${jobCounts.active}, Waiting: ${jobCounts.waiting}, Failed: ${jobCounts.failed}`,
    };
  } catch (error) {
    logger.error("Queue health check failed", { error });
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Unknown error",
      responseTime: Date.now() - start,
    };
  }
}

export const healthCheck = async (
  req: Request,
  res: Response
): Promise<void> => {
  const env = getEnv();
  const isProduction = env.NODE_ENV === "production";

  // In production, require Authorization: Bearer <HEALTH_API_KEY> for detailed output
  if (isProduction && env.HEALTH_API_KEY) {
    const authHeader = req.headers["authorization"];
    const provided = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;
    if (provided !== env.HEALTH_API_KEY) {
      // Return a fixed 200 response — never leak health state to unauthenticated callers
      res.status(200).json({ status: "ok" });
      return;
    }
  }

  try {
    const [database, redis, email, queue] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkEmail(),
      checkQueue(),
    ]);

    const allServicesHealthy =
      database.status === "up" &&
      redis.status === "up" &&
      email.status === "up" &&
      queue.status === "up";

    const health: HealthStatus = {
      status: allServicesHealthy ? "healthy" : "unhealthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
        email,
        queue,
      },
      version: env.APP_VERSION,
    };

    const statusCode = allServicesHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error("Health check failed", { error });
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const readinessCheck = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const database = await checkDatabase();

    if (database.status === "up") {
      res.status(200).json({
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: "not ready",
        reason: "Database unavailable",
      });
    }
  } catch (error) {
    res.status(503).json({
      status: "not ready",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
