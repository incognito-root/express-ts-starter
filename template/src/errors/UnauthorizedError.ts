import { AppError } from "./AppError";

export class UnauthorizedError extends AppError {
  constructor(
    message = "Unauthorized",
    options?: {
      cause?: Error;
      resource?: string;
    }
  ) {
    super(
      options?.resource
        ? `Unauthorized access to ${options.resource}`
        : message,
      401,
      { cause: options?.cause }
    );
  }
}
