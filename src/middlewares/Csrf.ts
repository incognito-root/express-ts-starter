import { doubleCsrf } from "csrf-csrf";
import { Request, Response, NextFunction } from "express";

import {
  cookieSecure,
  csrfCookieSameSite,
  cookieDomain,
} from "../config/cookies";
import { getEnv } from "../config/env";

const env = getEnv();

const cookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: csrfCookieSameSite,
  domain: cookieDomain,
};

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  cookieName: "_csrf",
  cookieOptions,
  // Only accept the token from headers — never from query params, which leak
  // tokens via Referer headers, browser history, and server access logs.
  getTokenFromRequest: (req) => {
    return (
      (req.headers["x-csrf-token"] as string) ||
      (req.headers["csrf-token"] as string) ||
      undefined
    );
  },
});

export const csrfProtection = doubleCsrfProtection;

export const setCsrfToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.cookie("XSRF-TOKEN", generateToken(req, res), {
      httpOnly: false,
      secure: cookieSecure,
      sameSite: csrfCookieSameSite,
      domain: cookieDomain,
    });
    next();
  } catch (error) {
    next(error);
  }
};
