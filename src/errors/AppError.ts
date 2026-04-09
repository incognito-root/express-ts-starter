export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly cause?: Error;

  constructor(
    message: string,
    statusCode: number,
    options?: {
      isOperational?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true;
    this.cause = options?.cause;

    Error.captureStackTrace(this, this.constructor);

    if (this.cause && this.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${this.cause.stack}`;
    }
  }

  static fromError(
    error: unknown,
    defaultMessage: string,
    statusCode: number
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const errorMessage =
      error instanceof Error ? error.message : defaultMessage;
    return new AppError(errorMessage, statusCode, {
      cause: error instanceof Error ? error : undefined,
    });
  }
}
