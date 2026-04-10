import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

import { Role, TokenType } from "../../generated/prisma";
import { getEnv } from "../config/env";
import { ERROR_MESSAGES } from "../constants/errorMessages";
import { BadRequestError } from "../errors/BadRequestError";
import { InternalServerError } from "../errors/InternalServerError";
import { NotFoundError } from "../errors/NotFoundError";
import { TokenExpiredError } from "../errors/TokenExpiredError";
import { TokenRevokedError } from "../errors/TokenRevokedError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import { queueVerificationEmail } from "../queues/emailQueue";
import { withTransaction } from "../repositories/BaseRepository";
import { TokenRepository } from "../repositories/TokenRepository";
import { UserRepository } from "../repositories/UserRepository";
import { timeInMs, TokenPayload, PrismaTransactionClient } from "../types";
import { audit } from "../utils/auditLogger";
import logger from "../utils/logger";
import { verifyPassword } from "../utils/password";
import {
  blacklistToken,
  isTokenBlacklisted,
} from "../utils/redis/tokenBlacklist";

import { getUser } from "./userService";

const userRepository = new UserRepository();
const tokenRepository = new TokenRepository();

export const loginUser = async (
  email: string,
  password: string,
  rememberMe: boolean
) => {
  try {
    email = email.toLowerCase();

    const user = await authenticateUser(email, password);

    if (!user.isVerified) {
      throw new UnauthorizedError(
        "Email not verified. Please check your email for a verification link."
      );
    }

    const expiresAt = new Date(
      Date.now() + (rememberMe ? timeInMs.week : timeInMs.day)
    );

    const accessToken = generateToken(user.id, user.email, user.role, "ACCESS", rememberMe);
    const refreshToken = generateToken(user.id, user.email, user.role, "REFRESH", rememberMe);

    await storeToken(refreshToken, user.id, expiresAt, TokenType.REFRESH);

    audit("auth.login.success", { userId: user.id, email: user.email, rememberMe });

    return {
      accessToken,
      refreshToken,
      userId: user.id,
      expiresAt,
      rememberMe,
    };
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      audit("auth.login.failure", { email, reason: error.message });
      throw error;
    }

    throw new InternalServerError(ERROR_MESSAGES.ERROR_LOGIN_FAILED, {
      cause: error as Error,
    });
  }
};

export const refreshAccessToken = async (refreshToken: string) => {
  try {
    const decoded = await validateToken(refreshToken, "REFRESH");

    if (!decoded.id || !(typeof decoded.rememberMe === "boolean")) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN_PAYLOAD);
    }

    const user = await getUser(decoded.id, undefined);

    if (!user) {
      throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    const newAccessToken = generateToken(
      user.id,
      user.email,
      user.role,
      "ACCESS",
      decoded.rememberMe
    );
    const newRefreshToken = generateToken(
      user.id,
      user.email,
      user.role,
      "REFRESH",
      decoded.rememberMe
    );

    const expiresAt = new Date(
      Date.now() + (decoded.rememberMe ? timeInMs.week : timeInMs.day)
    );

    await withTransaction(async (tx) => {
      // Atomically revoke the old token and issue the new one.
      // If count === 0, the token was already consumed by a concurrent request.
      const deleted = await tokenRepository.deleteByToken(refreshToken, tx);
      if (deleted.count === 0) {
        throw new TokenRevokedError(ERROR_MESSAGES.TOKEN_REVOKED);
      }
      await storeToken(newRefreshToken, user.id, expiresAt, TokenType.REFRESH, tx);
    });

    audit("auth.token.refresh", { userId: user.id });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      userId: user.id,
      expiresAt,
      rememberMe: decoded.rememberMe,
    };
  } catch (error: unknown) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof TokenExpiredError ||
      error instanceof TokenRevokedError
    ) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError(ERROR_MESSAGES.REFRESH_TOKEN_EXPIRED, {
        cause: error,
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN_SIGNATURE, {
        cause: error,
      });
    }

    throw new UnauthorizedError(ERROR_MESSAGES.ERROR_REFRESH_TOKEN_FAILED, {
      cause: error as Error,
    });
  }
};

export const invalidateToken = async (token: string) => {
  try {
    const tokenCheck = await tokenRepository.findByToken(token);

    if (!tokenCheck) {
      return;
    }

    await tokenRepository.deleteByToken(token);
  } catch (error: unknown) {
    throw new InternalServerError(ERROR_MESSAGES.ERROR_INVALIDATE_TOKEN, {
      cause: error as Error,
    });
  }
};

export const validateToken = async (
  token: string,
  tokenType: "ACCESS" | "REFRESH" | "VERIFY_EMAIL"
) => {
  try {
    const secretKey = getEnv().JWT_SECRET;

    if (tokenType === "REFRESH" || tokenType === "VERIFY_EMAIL") {
      const storedToken = await tokenRepository.findByToken(token);
      if (!storedToken)
        throw new TokenRevokedError(ERROR_MESSAGES.TOKEN_REVOKED);
      if (storedToken.expiresAt < new Date()) {
        throw new TokenExpiredError(ERROR_MESSAGES.TOKEN_EXPIRED);
      }
    }

    const decoded = jwt.verify(token, secretKey) as TokenPayload;

    if (decoded.tokenType !== tokenType) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    if (tokenType === "ACCESS" && decoded.jti) {
      const revoked = await isTokenBlacklisted(decoded.jti);
      if (revoked) {
        throw new TokenRevokedError(ERROR_MESSAGES.TOKEN_REVOKED);
      }
    }

    return decoded;
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof TokenRevokedError ||
      error instanceof TokenExpiredError
    ) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError(`${tokenType} token expired`, {
        cause: error,
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN, {
        cause: error,
      });
    }
    throw error;
  }
};

export const storeToken = async (
  token: string,
  userId: string,
  expiresAt: Date,
  type: TokenType,
  tx?: PrismaTransactionClient
) => {
  await tokenRepository.createToken(
    {
      token,
      userId,
      expiresAt,
      type,
    },
    tx
  );
};

export const revokeRefreshToken = async (token: string) => {
  await tokenRepository.deleteByToken(token);
};

export const blacklistAccessToken = async (token: string): Promise<void> => {
  try {
    // Use jwt.decode (no verification) — we're revoking regardless of validity
    const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
    if (!decoded?.jti || !decoded.exp) return;
    await blacklistToken(decoded.jti, new Date(decoded.exp * 1000));
  } catch (error) {
    // Best-effort — don't fail logout if blacklisting fails
    logger.warn("Failed to blacklist access token", { error });
  }
};

export const getCurrentUser = async (userId: string) => {
  try {
    const user = await userRepository.findActiveById(userId);

    if (!user) {
      throw new UnauthorizedError(ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    throw new InternalServerError(ERROR_MESSAGES.ERROR_FETCHING_USER_DATA, {
      cause: error as Error,
    });
  }
};

export const generateToken = (
  userId: string,
  userEmail: string,
  role: Role,
  tokenType: "ACCESS" | "REFRESH" | "VERIFY_EMAIL",
  rememberMe: boolean
) => {
  const secretKey = getEnv().JWT_SECRET;
  const expiresIn =
    tokenType === "ACCESS"
      ? getEnv().JWT_ACCESS_EXPIRY
      : tokenType === "VERIFY_EMAIL"
        ? "1d"
        : rememberMe
          ? getEnv().JWT_REFRESH_EXPIRY
          : "1d";

  const payload: TokenPayload = {
    id: userId,
    email: userEmail,
    role,
    rememberMe,
    tokenType,
    jti: uuidv4(),
  };

  // expiresIn values are validated as ms-compatible durations by Zod in env.ts
  return jwt.sign(payload, secretKey, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
};

const authenticateUser = async (email: string, password: string) => {
  const user = await userRepository.findByEmail(email, true);

  if (!user || !user.isActive) {
    throw new UnauthorizedError(ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
  }

  const isPasswordValid = await verifyPassword(password, user.password);

  if (!isPasswordValid) {
    throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  return user;
};

export const sendVerificationEmail = async (
  userId: string,
  email: string,
  name: string,
  role: Role
) => {
  try {
    const verificationToken = generateToken(
      userId,
      email,
      role,
      "VERIFY_EMAIL",
      false
    );

    const expiresAt = new Date(Date.now() + timeInMs.day);
    await storeToken(
      verificationToken,
      userId,
      expiresAt,
      TokenType.VERIFY_EMAIL
    );

    await queueVerificationEmail({
      userId,
      email,
      name,
      verificationToken,
    });

    logger.info("Verification email queued successfully", { userId, email });
  } catch (error: unknown) {
    logger.error("Failed to queue verification email", {
      userId,
      email,
      error,
    });
    throw new InternalServerError(
      ERROR_MESSAGES.ERROR_SENDING_VERIFICATION_EMAIL,
      { cause: error as Error }
    );
  }
};

export const verifyEmail = async (token: string) => {
  try {
    const decoded = await validateToken(token, "VERIFY_EMAIL");

    const user = await userRepository.findById(decoded.id);

    if (!user) {
      throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (user.isVerified) {
      throw new BadRequestError(ERROR_MESSAGES.EMAIL_ALREADY_VERIFIED);
    }

    await withTransaction(async (tx) => {
      await userRepository.updateVerificationStatus(user.id, true, tx);
    });

    await tokenRepository.deleteByUserIdAndType(
      user.id,
      TokenType.VERIFY_EMAIL
    );

    logger.info("Email verified successfully", { userId: user.id });
    audit("auth.email.verified", { userId: user.id, email: user.email });

    return user;
  } catch (error: unknown) {
    if (
      error instanceof NotFoundError ||
      error instanceof BadRequestError ||
      error instanceof UnauthorizedError ||
      error instanceof TokenExpiredError ||
      error instanceof TokenRevokedError
    ) {
      throw error;
    }

    throw new InternalServerError(ERROR_MESSAGES.ERROR_VERIFYING_EMAIL, {
      cause: error as Error,
    });
  }
};
