import { AppError } from "./AppError";

export class InternalServerError extends AppError {
  constructor(
    message = "Internal server error",
    options?: {
      cause?: Error;
      isOperational?: boolean;
    }
  ) {
    const isOperational = options?.isOperational ?? false;
    super(message, 500, { cause: options?.cause, isOperational });
  }
}
