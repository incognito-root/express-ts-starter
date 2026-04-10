import ms from "ms";
import { z } from "zod";

/**
 * Validates that a string is a valid `ms`-compatible duration (e.g. "1h", "7d", "15m").
 * This is critical because `jwt.sign({ expiresIn })` expects `StringValue` from the `ms` package,
 * not an arbitrary string. Invalid values would cause jwt.sign to silently produce tokens
 * with no expiry or throw at runtime.
 */
const msDuration = z
  .string()
  .refine((val) => typeof ms(val as Parameters<typeof ms>[0]) === "number", {
    message: "Must be a valid duration string (e.g. '1h', '7d', '15m')",
  });

const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  APP_VERSION: z.string().default("1.0.0"),

  // Frontend
  FRONTEND_URL: z.string().url(),

  // CORS
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(",").map((o) => o.trim())),

  // Database
  DATABASE_URL: z.string().url(),
  DB_POOL_SIZE: z.coerce.number().min(1).max(100).default(10),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRY: msDuration.default("1h"),
  JWT_REFRESH_EXPIRY: msDuration.default("7d"),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().optional(),

  // Email
  EMAIL_HOST: z.string(),
  EMAIL_PORT: z.coerce.number(),
  EMAIL_SECURE: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  EMAIL_USER: z.string(),
  EMAIL_PASSWORD: z.string(),
  EMAIL_FROM: z.string().email(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Logging
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),

  // Security
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  // @feature:csrf
  CSRF_SECRET: z.string().min(32, "CSRF_SECRET must be at least 32 characters"),
  // @end:csrf
  COOKIE_DOMAIN: z.string().optional(),
  HEALTH_API_KEY: z.string().min(16).optional(),

  // @feature:uploads
  // Cloudinary (optional - media uploads)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  // @end:uploads
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function validateEnv(): Env {
  try {
    env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      );
      console.error("Invalid environment variables:");
      missingVars.forEach((msg) => console.error(`  - ${msg}`));
      process.exit(1);
    }
    throw error;
  }
}

export function getEnv(): Env {
  if (!env) {
    env = envSchema.parse(process.env);
  }
  return env;
}
