import { AppError } from "./AppError";

export class ConflictError extends AppError {
  constructor(
    message: string = "Conflict",
    options?: {
      cause?: Error;
      resource?: string;
    }
  ) {
    super(
      options?.resource ? `Conflict related to ${options.resource}` : message,
      409,
      { cause: options?.cause }
    );
  }
}
