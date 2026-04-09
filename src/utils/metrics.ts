/**
 * Prometheus metrics registry.
 *
 * Exposes Node.js runtime metrics (heap, GC, event loop lag, etc.) plus
 * application-level HTTP request counters and duration histograms.
 *
 * Consumed by:
 *   src/middlewares/Metrics.ts  — increments per-request labels on res.finish
 *   src/createApp.ts            — serves GET /metrics in Prometheus text format
 */

import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

export const register = new Registry();

// Default Node.js process metrics: heap_space_size, gc_duration, event_loop_lag,
// process_cpu_seconds, process_resident_memory, fd counts, and more.
collectDefaultMetrics({ register });

/**
 * Total HTTP requests processed.
 * Labels: method, route (normalized), status_code.
 */
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests processed",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [register],
});

/**
 * HTTP request duration histogram in milliseconds.
 * Buckets chosen to cover typical API latency (5 ms – 5 s).
 * Labels: method, route (normalized), status_code.
 */
export const httpRequestDurationMs = new Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});
