import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // No Prisma mock aliases — integration tests use the real generated client.
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/integration/setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    // Run sequentially to avoid DB race conditions between test files.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
