import { AppError } from "./AppError";

export class NotFoundError extends AppError {
  constructor(
    message = "Resource not found",
    options?: {
      cause?: Error;
      resource?: string;
    }
  ) {
    super(options?.resource ? `${options.resource} not found` : message, 404, {
      cause: options?.cause,
    });
  }

  static resource(resourceName: string, id?: string): NotFoundError {
    const message = id
      ? `${resourceName} with ID ${id} not found`
      : `${resourceName} not found`;
    return new NotFoundError(message);
  }
}
