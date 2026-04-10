// Runs once before all integration test files.
// Syncs the Prisma schema to the test database and flushes Redis.

import { execSync } from "child_process";
import path from "path";
import dotenv from "dotenv";

export async function setup() {
  dotenv.config({
    path: path.resolve(__dirname, "../../.env.test"),
    override: true,
  });

  // Allow CI to override via TEST_DATABASE_URL / TEST_REDIS_URL
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
  if (process.env.TEST_REDIS_URL) {
    process.env.REDIS_URL = process.env.TEST_REDIS_URL;
  }

  // Push schema to test DB (no migration files required).
  // Prisma 7 config uses a driver adapter, so db push needs --url explicitly.
  // PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION is required when run via AI tooling.
  const dbUrl = process.env.DATABASE_URL;
  execSync(`npx prisma db push --force-reset --url "${dbUrl}"`, {
    stdio: "pipe",
    env: {
      ...process.env,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes",
    },
  });

  // Flush test Redis
  const { createClient } = await import("redis");
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  await redis.flushDb();
  await redis.quit();
}
