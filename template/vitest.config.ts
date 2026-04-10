import { fileURLToPath } from "url";
import path from "path";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    projects: [
      // Unit tests — mocked Prisma, no real DB/Redis
      {
        resolve: {
          tsconfigPaths: true,
          alias: [
            {
              find: /.*generated\/prisma\/client.*/,
              replacement: path.resolve(__dirname, "tests/mocks/prisma.ts"),
            },
            {
              find: /.*generated\/prisma.*/,
              replacement: path.resolve(__dirname, "tests/mocks/prisma.ts"),
            },
          ],
        },
        test: {
          name: "unit",
          globals: true,
          environment: "node",
          setupFiles: ["./tests/setup.ts"],
          include: ["tests/unit/**/*.test.ts"],
          coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: [
              "src/app.ts",
              "src/types/**",
              "src/constants/**",
              "src/config/swagger.ts",
              "src/config/imagePresets.ts",
            ],
            reporter: ["text", "html"],
          },
        },
      },

      // Integration tests — real Prisma, real DB + Redis
      {
        resolve: {
          tsconfigPaths: true,
          alias: [
            // Map generated/prisma (no index.ts) → real entry point client.ts
            {
              find: /.*generated\/prisma.*/,
              replacement: path.resolve(__dirname, "generated/prisma/client.ts"),
            },
            {
              find: /.*queues\/emailQueue.*/,
              replacement: path.resolve(
                __dirname,
                "tests/integration/mocks/emailQueue.ts"
              ),
            },
          ],
        },
        test: {
          name: "integration",
          globals: true,
          environment: "node",
          setupFiles: ["./tests/integration/setup.ts"],
          globalSetup: ["./tests/integration/globalSetup.ts"],
          include: ["tests/integration/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 15000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
