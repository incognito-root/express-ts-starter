import { body, ValidationChain } from "express-validator";
import DOMPurify from "isomorphic-dompurify";

import { ERROR_MESSAGES } from "../constants/errorMessages";
import { BadRequestError } from "../errors/BadRequestError";

// Password validation with strong requirements
export const strongPasswordValidation = (): ValidationChain =>
  body("password")
    .isLength({ min: 12, max: 128 })
    .withMessage("Password must be between 12 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)"
    );

// Email validation with disposable email check
const DISPOSABLE_EMAIL_DOMAINS = [
  "tempmail.com",
  "throwaway.email",
  "guerrillamail.com",
  "10minutemail.com",
  "mailinator.com",
];

export const enhancedEmailValidation = (): ValidationChain =>
  body("email")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail()
    .custom((email: string) => {
      const domain = email.split("@")[1];
      if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
        throw new BadRequestError(ERROR_MESSAGES.DISPOSABLE_EMAIL_NOT_ALLOWED);
      }
      return true;
    });

// Phone validation with specific formats
export const phoneValidation = (): ValidationChain =>
  body("phone")
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage("Phone number must be in E.164 format (e.g., +1234567890)");

// Name validation (no special characters, reasonable length)
export const nameValidation = (fieldName = "name"): ValidationChain =>
  body(fieldName)
    .isLength({ min: 2, max: 100 })
    .withMessage(`${fieldName} must be between 2 and 100 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`
    )
    .trim();

// URL validation
export const urlValidation = (fieldName: string): ValidationChain =>
  body(fieldName)
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage(`${fieldName} must be a valid URL`);

// UUID validation
export const uuidValidation = (fieldName: string): ValidationChain =>
  body(fieldName).isUUID().withMessage(`${fieldName} must be a valid UUID`);
