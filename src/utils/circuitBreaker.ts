import { ERROR_MESSAGES } from "../constants/errorMessages";
import { InternalServerError } from "../errors/InternalServerError";
import logger from "../utils/logger";

interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
}

interface CircuitBreakerState {
  isOpen: boolean;
  isHalfOpen: boolean;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
}

type AsyncFunction<TArgs extends unknown[], TReturn> = (
  ...args: TArgs
) => Promise<TReturn>;

export class CircuitBreaker<TArgs extends unknown[], TReturn> {
  private state: CircuitBreakerState = {
    isOpen: false,
    isHalfOpen: false,
    failures: 0,
    successes: 0,
    lastFailureTime: null,
  };

  constructor(
    private fn: AsyncFunction<TArgs, TReturn>,
    private name: string,
    private options: Required<CircuitBreakerOptions>
  ) {}

  async execute(...args: TArgs): Promise<TReturn> {
    if (this.state.isOpen) {
      if (this.shouldAttemptReset()) {
        this.state.isHalfOpen = true;
        logger.info(`Circuit breaker half-open for: ${this.name}`);
      } else {
        throw new InternalServerError(
          `${ERROR_MESSAGES.CIRCUIT_BREAKER_OPEN}: ${this.name}`
        );
      }
    }

    try {
      const result = await this.executeWithTimeout(...args);

      this.state.successes++;
      if (this.state.isHalfOpen) {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  private async executeWithTimeout(...args: TArgs): Promise<TReturn> {
    return Promise.race([
      this.fn(...args),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout: ${this.name}`)),
          this.options.timeout
        )
      ),
    ]);
  }

  private recordFailure(error: unknown): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    logger.error(`Circuit breaker failure for: ${this.name}`, {
      error: error instanceof Error ? error.message : String(error),
      failures: this.state.failures,
    });

    const totalRequests = this.state.failures + this.state.successes;
    const failureRate =
      totalRequests === 0 ? 0 : (this.state.failures / totalRequests) * 100;
    if (failureRate >= this.options.errorThresholdPercentage) {
      this.state.isOpen = true;
      logger.warn(`Circuit breaker opened for: ${this.name}`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.state.lastFailureTime) return false;
    return Date.now() - this.state.lastFailureTime >= this.options.resetTimeout;
  }

  private reset(): void {
    this.state = {
      isOpen: false,
      isHalfOpen: false,
      failures: 0,
      successes: 0,
      lastFailureTime: null,
    };
    logger.info(`Circuit breaker closed for: ${this.name}`);
  }

  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }
}

export function createCircuitBreaker<TArgs extends unknown[], TReturn>(
  fn: AsyncFunction<TArgs, TReturn>,
  name: string,
  options: CircuitBreakerOptions = {}
): CircuitBreaker<TArgs, TReturn> {
  const defaultOptions: Required<CircuitBreakerOptions> = {
    timeout: options.timeout ?? 3000,
    errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
    resetTimeout: options.resetTimeout ?? 30000,
  };

  return new CircuitBreaker(fn, name, defaultOptions);
}

// Email service circuit breaker
export const emailCircuitBreaker = createCircuitBreaker(
  async (emailFn: () => Promise<void>): Promise<void> => {
    return await emailFn();
  },
  "EmailService",
  {
    timeout: 5000,
    errorThresholdPercentage: 60,
    resetTimeout: 60000,
  }
);
