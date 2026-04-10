import { UnauthorizedError } from "./UnauthorizedError";

export class TokenRevokedError extends UnauthorizedError {
  constructor(
    message = "Token revoked",
    options?: {
      cause?: Error;
      resource?: string;
    }
  ) {
    super(
      options?.resource
        ? `Token for ${options.resource} has been revoked`
        : message,
      { cause: options?.cause }
    );
  }
}
