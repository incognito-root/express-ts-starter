import { Request, Response, NextFunction } from "express";

import { AuthContext, Role } from "../../generated/prisma/client";
import { cookieSecure, authCookieSameSite } from "../config/cookies";
import { ERROR_MESSAGES } from "../constants/errorMessages";
import { ForbiddenError } from "../errors/ForbiddenError";
import { InternalServerError } from "../errors/InternalServerError";
import { TokenExpiredError } from "../errors/TokenExpiredError";
import { TokenRevokedError } from "../errors/TokenRevokedError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import * as authService from "../services/authService";
import * as userService from "../services/userService";
import { TypedRequestWithUser, timeInMs } from "../types/";

const getTokensFromCookies = (
  req: Request
): { accessToken: string; refreshToken: string } => ({
  accessToken: (req.cookies?.accessToken as string) || "",
  refreshToken: (req.cookies?.refreshToken as string) || "",
});

export const verifyToken = async (
  req: TypedRequestWithUser,
  res: Response,
  next: NextFunction
) => {
  const { accessToken, refreshToken } = getTokensFromCookies(req as Request);

  if (!accessToken && !refreshToken) {
    return next(new UnauthorizedError("Access denied. No token provided."));
  }

  try {
    const decoded = await authService.validateToken(accessToken, "ACCESS");

    req.user = decoded;
    return next();
  } catch (error: unknown) {
    if (!refreshToken) {
      return next(
        new TokenExpiredError("Access token expired or invalid.", {
          cause: error instanceof Error ? error : undefined,
        })
      );
    }

    try {
      const result = await authService.refreshAccessToken(refreshToken);

      if (!result?.accessToken || !result.refreshToken) {
        return next(new UnauthorizedError("Token refresh failed."));
      }

      res.cookie("accessToken", result.accessToken, {
        maxAge: timeInMs.hour,
        httpOnly: true,
        secure: cookieSecure,
        sameSite: authCookieSameSite,
      });

      res.cookie("refreshToken", result.refreshToken, {
        maxAge: result.rememberMe ? timeInMs.week : timeInMs.day,
        httpOnly: true,
        secure: cookieSecure,
        sameSite: authCookieSameSite,
      });

      const decoded = await authService.validateToken(
        result.accessToken,
        "ACCESS"
      );

      req.user = decoded;
      next();
    } catch (refreshError) {
      if (refreshError instanceof TokenRevokedError) {
        return next(new UnauthorizedError("Refresh token has been revoked."));
      }

      return next(new UnauthorizedError("Invalid or expired refresh token."));
    }
  }
};

export const checkUserStatus = async (
  req: TypedRequestWithUser,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError(ERROR_MESSAGES.MISSING_USER_ID_IN_TOKEN);
    }

    const user = await userService.getUser(userId, undefined);

    if (!user) {
      return next(new UnauthorizedError("User account does not exist."));
    }

    next();
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error) {
      return next(
        new InternalServerError("Database error.", {
          cause: error instanceof Error ? error : undefined,
        })
      );
    }

    return next(
      new InternalServerError("Failed to verify user status.", {
        cause: error instanceof Error ? error : undefined,
      })
    );
  }
};

export const requireSuperAdmin = (
  req: TypedRequestWithUser,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role } = req.user;

    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenError(ERROR_MESSAGES.SUPER_ADMIN_REQUIRED);
    }

    next();
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Requires the user to be operating in PLATFORM context.
 * Extend TokenPayload with `context?: AuthContext` to enable this middleware.
 */
export const requirePlatformContext = (
  req: TypedRequestWithUser,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role, context } = req.user;

    if (role === Role.SUPER_ADMIN) {
      return next();
    }

    if (!context || context !== AuthContext.PLATFORM) {
      throw new ForbiddenError(
        "This action requires PLATFORM context. Please switch context."
      );
    }

    next();
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Requires the user to be operating in ORGANIZATION context.
 * Extend TokenPayload with `context?: AuthContext` and `organizationId?: string` to enable this middleware.
 */
export const requireOrganizationContext = (
  req: TypedRequestWithUser,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role, context, organizationId } = req.user;

    if (role === Role.SUPER_ADMIN) {
      return next();
    }

    if (!context || context !== AuthContext.ORGANIZATION) {
      throw new ForbiddenError(
        "This action requires ORGANIZATION context. Please switch context."
      );
    }

    if (!organizationId) {
      throw new ForbiddenError(ERROR_MESSAGES.NO_ORGANIZATION_SELECTED);
    }

    next();
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Requires the user to have one of the specified roles within their organization context.
 * Extend TokenPayload with `context?: AuthContext` and `organizationRole?: Role` to enable this middleware.
 */
export const requireOrganizationRole = (allowedRoles: Role[]) => {
  return (req: TypedRequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { role, context, organizationRole } = req.user;

      if (role === Role.SUPER_ADMIN) {
        return next();
      }

      if (!context || context !== AuthContext.ORGANIZATION) {
        throw new ForbiddenError(
          "This action requires ORGANIZATION context. Please switch context."
        );
      }

      if (!organizationRole || !allowedRoles.includes(organizationRole)) {
        throw new ForbiddenError(
          `Insufficient permissions. Required roles: ${allowedRoles.join(", ")}`
        );
      }

      next();
    } catch (error: unknown) {
      next(error);
    }
  };
};
