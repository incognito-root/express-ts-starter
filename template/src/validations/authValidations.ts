import { body } from "express-validator";

export const userLoginValidation = [
  body("email")
    .isEmail()
    .withMessage("Email must be valid")
    .notEmpty()
    .withMessage("Email is required"),

  body("password")
    .isString()
    .withMessage("Password must be a string")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: 64 })
    .withMessage("Password must not exceed 64 characters"),

  body("rememberMe")
    .optional()
    .isBoolean()
    .withMessage("Remember me must be a boolean"),
];

export const emailVerificationValidation = [
  body("token")
    .isString()
    .withMessage("Verification token must be a string")
    .notEmpty()
    .withMessage("Verification token is required"),
];
