import express, { RequestHandler } from "express";

import * as authController from "../controllers/authController";
import { verifyToken } from "../middlewares/Auth";
// @feature:csrf
import { csrfProtection, setCsrfToken } from "../middlewares/Csrf";
// @end:csrf
import { authRateLimiter, strictRateLimiter } from "../middlewares/RateLimiter";
import { handleValidationErrors } from "../middlewares/Validation";
import * as authValidations from "../validations/authValidations";

const router = express.Router();

/**
 * @swagger
 * /v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Login successful — accessToken and refreshToken set as httpOnly cookies
 *       401:
 *         description: Invalid credentials or unverified email
 *       429:
 *         description: Too many login attempts
 */
// @feature:csrf
router.post(
  "/login",
  authRateLimiter,
  csrfProtection,
  authValidations.userLoginValidation,
  handleValidationErrors,
  authController.loginUser
);
// @end:csrf
// @feature:!csrf
router.post(
  "/login",
  authRateLimiter,
  authValidations.userLoginValidation,
  handleValidationErrors,
  authController.loginUser
);
// @end:!csrf

/**
 * @swagger
 * /v1/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User data retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get(
  "/me",
  verifyToken as RequestHandler,
  authController.getCurrentUser as RequestHandler
);

/**
 * @swagger
 * /v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
// @feature:csrf
router.post(
  "/logout",
  verifyToken as RequestHandler,
  csrfProtection,
  authController.logout as RequestHandler
);
// @end:csrf
// @feature:!csrf
router.post(
  "/logout",
  verifyToken as RequestHandler,
  authController.logout as RequestHandler
);
// @end:!csrf

/**
 * @swagger
 * /v1/auth/verify-email:
 *   post:
 *     summary: Verify user email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
// @feature:csrf
router.post(
  "/verify-email",
  strictRateLimiter,
  csrfProtection,
  authValidations.emailVerificationValidation,
  handleValidationErrors,
  authController.verifyEmail
);
// @end:csrf
// @feature:!csrf
router.post(
  "/verify-email",
  strictRateLimiter,
  authValidations.emailVerificationValidation,
  handleValidationErrors,
  authController.verifyEmail
);
// @end:!csrf

// @feature:csrf
/**
 * @swagger
 * /v1/auth/csrf-token:
 *   get:
 *     summary: Get CSRF token
 *     tags: [Authentication]
 *     description: Retrieve a CSRF token for state-changing operations. The token is also set in a cookie.
 *     responses:
 *       200:
 *         description: CSRF token retrieved
 */
router.get("/csrf-token", csrfProtection, setCsrfToken, (req, res) => {
  res.json({ csrfToken: req.csrfToken!() });
});
// @end:csrf

export default router;
