/**
 * OpenTelemetry tracing initialization.
 *
 * This module MUST be imported after dotenv is configured and before any
 * instrumented modules (express, http, etc.) are loaded. In src/app.ts it
 * is placed immediately after dotenv.config() for this reason.
 *
 * The SDK is only started when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * If the variable is absent the module is a no-op — @opentelemetry/api's
 * no-op tracer is used throughout the app, and all trace.getActiveSpan()
 * calls return undefined.
 *
 * Supported env vars (standard OTEL conventions):
 *   OTEL_EXPORTER_OTLP_ENDPOINT  e.g. http://localhost:4318
 *   OTEL_SERVICE_NAME             defaults to npm_package_name
 *   APP_VERSION                   used as service.version
 *
 * Compatible with: Jaeger, Grafana Tempo, Honeycomb, Datadog (OTLP mode).
 */

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

let sdk: NodeSDK | undefined;

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (otlpEndpoint) {
  // Ensure service name / version are set so the SDK's built-in envDetector
  // picks them up automatically (OTEL standard resource detection).
  process.env.OTEL_SERVICE_NAME ??=
    process.env.npm_package_name ?? "express-ts-starter";
  process.env.OTEL_SERVICE_VERSION ??= process.env.APP_VERSION ?? "1.0.0";

  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
    ],
  });

  sdk.start();
}

/**
 * Flush and shut down the OTEL SDK. Call during graceful shutdown to ensure
 * in-flight spans are exported before the process exits.
 * Safe to call even when OTEL is not configured (no-op).
 */
export async function otelShutdown(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}
