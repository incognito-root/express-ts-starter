// Integration test setup — runs before every test file.
// Env vars must be set before any app module is imported (module-level getEnv() calls).

import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(__dirname, "../../.env.test"),
  override: true,
});
process.env.NODE_ENV = "test";

// Allow CI to override via TEST_DATABASE_URL / TEST_REDIS_URL
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
if (process.env.TEST_REDIS_URL) {
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
}
