import { AppError } from "./AppError";

export interface FormattedError {
  field: string;
  message: string;
}

export class BadRequestError extends AppError {
  errors?: FormattedError[];

  constructor(
    message: string,
    errorsOrOptions?:
      | FormattedError[]
      | {
          errors?: FormattedError[];
          cause?: Error;
        }
  ) {
    // Handle both constructor patterns
    if (Array.isArray(errorsOrOptions)) {
      super(message, 400);
      this.errors = errorsOrOptions;
    } else {
      super(message, 400, { cause: errorsOrOptions?.cause });
      this.errors = errorsOrOptions?.errors;
    }

    Object.setPrototypeOf(this, BadRequestError.prototype);
  }

  static fromValidationErrors(
    errors: FormattedError[],
    message = "Validation failed"
  ): BadRequestError {
    return new BadRequestError(message, { errors });
  }
}
