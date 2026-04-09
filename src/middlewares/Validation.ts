import { Request, Response, NextFunction } from "express";
import { ValidationError, validationResult } from "express-validator";

import { BadRequestError } from "../errors/BadRequestError";

interface FormattedError {
  field: string;
  message: string;
}

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors: FormattedError[] = errors
      .array()
      .map((error: ValidationError) => {
        if (error.type === "field") {
          return {
            field: error.path,
            message: error.msg as string,
          };
        }
        return {
          field: "unknown",
          message: error.msg as string,
        };
      });

    return next(new BadRequestError("Validation failed", formattedErrors));
  }

  next();
};
