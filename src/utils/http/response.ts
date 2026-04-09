import { Response } from "express";

import { Env, getEnv } from "../../config/env";
import { ApiResponse, CookieOptions } from "../../types";
import { timeInMs } from "../../types/util/timeInMS";

const env: Env = getEnv();
const isProduction: boolean = env.NODE_ENV === "production";
const isDevelopmentRemote: boolean =
  env.NODE_ENV === "development" &&
  env.CORS_ORIGINS.some((origin) => origin.includes("localhost"));
const cookieSecure: boolean = isProduction || isDevelopmentRemote;
const cookieSameSite: "strict" | "lax" | "none" = isProduction ? "lax" : "none";

function successResponse<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
  metadata?: Record<string, unknown>,
  cookies?: CookieOptions[]
): void {
  const response: ApiResponse<T> = {
    status: "success",
    data: data,
    message: message,
    metadata: metadata,
  };

  if (cookies && cookies.length > 0) {
    cookies.forEach((cookie) => {
      res.cookie(cookie.name, cookie.value, {
        maxAge: cookie.maxAge ?? timeInMs.hour,
        httpOnly: cookie.httpOnly ?? true,
        secure: cookie.secure ?? cookieSecure,
        sameSite: cookie.sameSite ?? cookieSameSite,
        domain: isProduction ? env.COOKIE_DOMAIN : undefined,
        path: cookie.path ?? "/",
      });
    });
  }

  res.status(statusCode).json(response);
}

export default successResponse;
