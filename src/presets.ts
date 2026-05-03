import type { FeatureName } from "./types.js";

export interface Preset {
  name: string;
  description: string;
  features: FeatureName[];
}

export const PRESETS: Record<string, Preset> = {
  minimal: {
    name: "Minimal",
    description: "Core Express + TypeScript setup only. No optional features.",
    features: [],
  },
  recommended: {
    name: "Recommended",
    description:
      "Production-ready with commonly needed features.",
    features: ["bullmq", "metrics", "versioning", "csrf", "audit", "resend"],
  },
  full: {
    name: "Full",
    description: "Everything enabled — the complete template.",
    features: [
      "websocket",
      "uploads",
      "bullmq",
      "metrics",
      "otel",
      "versioning",
      "idempotency",
      "circuitBreaker",
      "resend",
      "csrf",
      "audit",
      "k6",
      "pm2",
    ],
  },
};
