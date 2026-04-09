import { AppError } from "./AppError";

export class ForbiddenError extends AppError {
  constructor(
    message: string = "Forbidden",
    options?: {
      cause?: Error;
      resource?: string;
    }
  ) {
    super(
      options?.resource ? `Forbidden access to ${options.resource}` : message,
      403,
      { cause: options?.cause }
    );
  }
}
