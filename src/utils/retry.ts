import logger from "./logger";

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Base delay in milliseconds before exponential growth. Default: 500 */
  baseDelayMs?: number;
  /** Upper cap on delay in milliseconds. Default: 10 000 */
  maxDelayMs?: number;
  /**
   * Add ±25% jitter to each delay to prevent thundering-herd when multiple
   * callers retry simultaneously. Default: true
   */
  jitter?: boolean;
  /**
   * Return false to stop retrying immediately (e.g. on 4xx errors that will
   * never succeed). Called with the thrown error and the 1-based attempt
   * number that just failed. Default: always retry.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Retries an async operation with exponential back-off.
 *
 * @example
 * const data = await withRetry(() => fetch("https://api.example.com/data"), {
 *   maxAttempts: 4,
 *   baseDelayMs: 200,
 *   shouldRetry: (err) => !(err instanceof ValidationError),
 * });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 10_000,
    jitter = true,
    shouldRetry = () => true,
  } = options ?? {};

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt || !shouldRetry(error, attempt)) {
        break;
      }

      const exponential = baseDelayMs * Math.pow(2, attempt - 1);
      const capped = Math.min(exponential, maxDelayMs);
      const delay = jitter ? capped * (0.75 + Math.random() * 0.5) : capped;

      logger.warn("Retrying operation after failure", {
        attempt,
        maxAttempts,
        delayMs: Math.round(delay),
        error,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
