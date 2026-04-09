import { AppError } from "./AppError";

interface RateLimitErrorOptions {
  ttl?: number;
  limit?: number;
  retryAfter?: number;
}

export class RateLimitError extends AppError {
  public ttl: number;
  public limit?: number;
  public retryAfter: number;

  constructor(
    message: string = "Too many requests, please try again later",
    options: RateLimitErrorOptions = {}
  ) {
    super(message, 429);
    this.name = "RateLimitError";
    this.ttl = options.ttl || 60;
    this.limit = options.limit;
    this.retryAfter = options.retryAfter || this.ttl;
  }
}
