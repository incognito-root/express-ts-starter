import type { FeatureDefinition } from "./types.js";

export const FEATURES: FeatureDefinition[] = [
  {
    name: "websocket",
    label: "WebSocket (Socket.IO)",
    description: "Real-time communication with Socket.IO and Redis adapter",
    includePaths: [
      "src/websocket/",
      "src/utils/websocket/",
      "src/types/websocket/",
    ],
    dependencies: {
      "socket.io": "^4.8.1",
      "@socket.io/redis-adapter": "^8.3.0",
    },
  },
  {
    name: "uploads",
    label: "File Uploads (Multer + Cloudinary)",
    description: "File upload handling with Multer and Cloudinary storage",
    includePaths: [
      "src/middlewares/FileUpload.ts",
      "src/utils/media/",
      "src/config/imagePresets.ts",
      "src/types/media/",
    ],
    dependencies: {
      multer: "^2.0.2",
      cloudinary: "^2.8.0",
    },
    devDependencies: {
      "@types/multer": "^2.0.0",
    },
  },
  {
    name: "bullmq",
    label: "Email Queue (BullMQ)",
    description: "Background email processing with BullMQ (Redis-backed queue)",
    includePaths: ["src/queues/", "src/types/queue/"],
    dependencies: {
      bullmq: "^5.0.0",
    },
  },
  {
    name: "metrics",
    label: "Prometheus Metrics",
    description: "HTTP request metrics and /metrics endpoint with prom-client",
    includePaths: ["src/middlewares/Metrics.ts", "src/utils/metrics.ts"],
    dependencies: {
      "prom-client": "^15.1.3",
    },
  },
  {
    name: "otel",
    label: "OpenTelemetry Tracing",
    description: "Distributed tracing with OpenTelemetry SDK and OTLP exporter",
    includePaths: ["src/tracing.ts"],
    dependencies: {
      "@opentelemetry/api": "^1.9.1",
      "@opentelemetry/sdk-node": "^0.214.0",
      "@opentelemetry/exporter-trace-otlp-http": "^0.214.0",
      "@opentelemetry/instrumentation-express": "^0.62.0",
      "@opentelemetry/instrumentation-http": "^0.214.0",
    },
  },
  {
    name: "versioning",
    label: "API Versioning",
    description:
      "Version headers and deprecation/sunset notices for API routes",
    includePaths: [
      "src/middlewares/ApiVersion.ts",
      "src/config/versions.ts",
      "docs/api-versioning.md",
    ],
    dependencies: {},
  },
  {
    name: "idempotency",
    label: "Idempotency Middleware",
    description:
      "Redis-backed idempotency guard for safe request retries",
    includePaths: [
      "src/middlewares/Idempotency.ts",
      "tests/unit/middlewares/Idempotency.test.ts",
    ],
    dependencies: {},
  },
  {
    name: "circuitBreaker",
    label: "Circuit Breaker",
    description: "Resilience pattern for external service calls",
    includePaths: ["src/utils/circuitBreaker.ts"],
    dependencies: {},
  },
  {
    name: "resend",
    label: "Resend Email Provider",
    description: "Enable Resend as the default email provider in .env.example",
    includePaths: [],
    dependencies: {},
  },
  {
    name: "audit",
    label: "Audit Logger",
    description:
      "Structured audit logging with daily rotation for compliance tracking",
    includePaths: ["src/utils/auditLogger.ts"],
    dependencies: {},
  },
  {
    name: "csrf",
    label: "CSRF Protection",
    description: "Double-submit cookie CSRF protection for state-changing routes",
    includePaths: [
      "src/middlewares/Csrf.ts",
      "tests/integration/auth/csrf-protection.test.ts",
    ],
    dependencies: {
      "csrf-csrf": "^3.0.0",
    },
  },
  {
    name: "k6",
    label: "k6 Load Tests",
    description: "Pre-built k6 smoke, load, and rate-limit test scripts",
    includePaths: ["k6/"],
    removeScripts: ["k6:smoke", "k6:load", "k6:rate-limit"],
  },
  {
    name: "pm2",
    label: "PM2 Ecosystem",
    description: "PM2 process manager configuration for production deployment",
    includePaths: ["ecosystem.config.js"],
    dependencies: {},
  },
  {
    name: "aiInstructions",
    label: "AI Agent Instructions",
    description:
      "CLAUDE.md, GitHub Copilot instructions, and detailed .ai/ reference docs for coding assistants",
    hidden: true,
    includePaths: ["CLAUDE.md", ".github/copilot-instructions.md", ".ai/"],
    dependencies: {},
  },
];

export function getFeature(name: string): FeatureDefinition | undefined {
  return FEATURES.find((f) => f.name === name);
}
