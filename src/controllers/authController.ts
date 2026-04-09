import { Response, NextFunction } from "express";

import { cookieSecure, authCookieSameSite } from "../config/cookies";
import { ERROR_MESSAGES } from "../constants/errorMessages";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import * as authService from "../services/authService";
import {
  CookieOptions,
  timeInMs,
  TypedRequest,
  LoginRequestBody,
  VerifyEmailRequestBody,
  TypedRequestWithUser,
} from "../types";
import { audit } from "../utils/auditLogger";
import successResponse from "../utils/http/response";

export const loginUser = async (
  req: TypedRequest<LoginRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, rememberMe } = req.body;

    const result = await authService.loginUser(email, password, rememberMe);

    successResponse(
      res,
      { userId: result.userId, rememberMe },
      "Logged in successfully.",
      200,
      undefined,
      [
        {
          name: "accessToken",
          value: result.accessToken,
          maxAge: timeInMs.hour,
          httpOnly: true,
          secure: cookieSecure,
          sameSite: authCookieSameSite,
        } as CookieOptions,
        {
          name: "refreshToken",
          value: result.refreshToken,
          maxAge: rememberMe ? timeInMs.week : timeInMs.day,
          httpOnly: true,
          secure: cookieSecure,
          sameSite: authCookieSameSite,
        } as CookieOptions,
      ]
    );
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: TypedRequestWithUser,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError(ERROR_MESSAGES.USER_ID_NOT_FOUND_IN_TOKEN);
    }

    const user = await authService.getCurrentUser(userId);

    successResponse(res, user, "User data retrieved successfully", 200);
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: TypedRequestWithUser,
  res: Response,
  next: NextFunction
) => {
  try {
    const accessToken = req.cookies?.accessToken as string | undefined;
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    if (accessToken) {
      await authService.blacklistAccessToken(accessToken);
    }

    if (refreshToken) {
      await authService.invalidateToken(refreshToken);
    }

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: authCookieSameSite,
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: authCookieSameSite,
    });

    audit("auth.logout", { userId: req.user?.id });
    successResponse(res, null, "Logged out successfully", 200);
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (
  req: TypedRequest<VerifyEmailRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.body;

    await authService.verifyEmail(token);

    successResponse(
      res,
      {},
      "Email verified successfully. You can now login.",
      200
    );
  } catch (error) {
    next(error);
  }
};
