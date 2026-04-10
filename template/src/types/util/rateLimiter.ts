import { Request } from "express";

export interface RateLimitMiddlewareOptions {
  limit: number;
  windowInSeconds: number;
  keyGenerator?: (req: Request) => string;
  pointsToConsume?: number;
  blockDuration?: number;
  standardHeaders?: boolean;
  errorMessage?: string;
}
