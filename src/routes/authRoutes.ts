import express, { RequestHandler } from "express";

import * as authController from "../controllers/authController";
import { verifyToken } from "../middlewares/Auth";
import { csrfProtection, setCsrfToken } from "../middlewares/Csrf";
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
router.post(
  "/login",
  authRateLimiter,
  csrfProtection,
  authValidations.userLoginValidation,
  handleValidationErrors,
  authController.loginUser
);

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
router.post(
  "/logout",
  verifyToken as RequestHandler,
  csrfProtection,
  authController.logout as RequestHandler
);

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
router.post(
  "/verify-email",
  strictRateLimiter,
  csrfProtection,
  authValidations.emailVerificationValidation,
  handleValidationErrors,
  authController.verifyEmail
);

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
  res.json({ csrfToken: req.csrfToken() });
});

export default router;
