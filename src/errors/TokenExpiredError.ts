import { UnauthorizedError } from "./UnauthorizedError";

export class TokenExpiredError extends UnauthorizedError {
  constructor(
    message = "Token expired",
    options?: {
      cause?: Error;
      resource?: string;
    }
  ) {
    super(
      options?.resource ? `Token for ${options.resource} has expired` : message,
      { cause: options?.cause }
    );
  }
}
