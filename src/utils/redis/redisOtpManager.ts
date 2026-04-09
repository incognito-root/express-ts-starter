import { customAlphabet } from "nanoid";

import { ERROR_MESSAGES } from "../../constants/errorMessages";
import { InternalServerError } from "../../errors/InternalServerError";
import logger from "../logger";

import RedisSingleton from "./redisClient";

interface OTPOptions {
  expiryInSeconds?: number;
  length?: number;
  maxAttempts?: number;
  blockingTimeInSeconds?: number;
  useNumericOnly?: boolean;
}

export class RedisOTPManager {
  private client: ReturnType<typeof RedisSingleton.getClient>;
  private readonly defaultOptions: Required<OTPOptions> = {
    expiryInSeconds: 600,
    length: 6,
    maxAttempts: 5,
    blockingTimeInSeconds: 3600,
    useNumericOnly: true,
  };

  constructor() {
    this.client = RedisSingleton.getClient();
  }

  async generateOTP(userId: string, options: OTPOptions = {}): Promise<string> {
    try {
      await RedisSingleton.connect();
      const { expiryInSeconds, length, useNumericOnly } = {
        ...this.defaultOptions,
        ...options,
      };

      const alphabet = useNumericOnly
        ? "0123456789"
        : "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      const nanoid = customAlphabet(alphabet, length);
      const otp = nanoid();

      await this.setOTP(userId, otp, expiryInSeconds);

      return otp;
    } catch (error: unknown) {
      logger.error("Failed to generate OTP", { userId, error });
      throw new InternalServerError(ERROR_MESSAGES.OTP_FAILED_TO_GENERATE, {
        cause: error as Error,
      });
    }
  }

  async setOTP(
    userId: string,
    otp: string,
    expiryInSeconds: number = this.defaultOptions.expiryInSeconds
  ): Promise<void> {
    try {
      await RedisSingleton.connect();
      const key = this.getOTPKey(userId);

      await this.client.setEx(key, expiryInSeconds, otp);
      logger.debug("OTP set successfully", {
        userId,
        expiresIn: `${expiryInSeconds}s`,
      });
    } catch (error: unknown) {
      logger.error("Failed to set OTP", { userId, error });
      throw new InternalServerError(ERROR_MESSAGES.OTP_FAILED_TO_SET, {
        cause: error as Error,
      });
    }
  }

  async getOTP(userId: string): Promise<string | null> {
    try {
      await RedisSingleton.connect();
      const key = this.getOTPKey(userId);

      const otp = await this.client.get(key);
      return otp;
    } catch (error: unknown) {
      logger.error("Failed to get OTP", { userId, error });
      throw new InternalServerError(ERROR_MESSAGES.OTP_FAILED_TO_GET, {
        cause: error as Error,
      });
    }
  }

  async getOTPExpiry(userId: string): Promise<number | null> {
    try {
      await RedisSingleton.connect();
      const key = this.getOTPKey(userId);

      const ttl = await this.client.ttl(key);
      return ttl > 0 ? ttl : null;
    } catch (error: unknown) {
      logger.error("Failed to get OTP expiry", { userId, error });
      throw new InternalServerError(ERROR_MESSAGES.OTP_FAILED_TO_GET_EXPIRY, {
        cause: error as Error,
      });
    }
  }

  async verifyOTP(userId: string, otp: string): Promise<boolean> {
    try {
      await RedisSingleton.connect();

      if (await this.isUserBlocked(userId)) {
        logger.warn("OTP verification blocked due to too many attempts", {
          userId,
        });
        return false;
      }

      const key = this.getOTPKey(userId);
      const storedOTP = await this.client.get(key);

      if (storedOTP === otp) {
        await this.client.del(key);
        await this.clearOTPAttempts(userId);
        logger.info("OTP verification successful", { userId });
        return true;
      }

      await this.incrementOTPAttempts(userId);
      logger.warn("OTP verification failed", { userId });
      return false;
    } catch (error: unknown) {
      logger.error("Error during OTP verification", { userId, error });
      throw new InternalServerError(ERROR_MESSAGES.OTP_VERIFICATION_FAILED, {
        cause: error as Error,
      });
    }
  }

  async incrementOTPAttempts(
    userId: string,
    maxAttempts: number = this.defaultOptions.maxAttempts,
    expiryInSeconds: number = this.defaultOptions.blockingTimeInSeconds
  ): Promise<boolean> {
    try {
      await RedisSingleton.connect();
      const key = this.getAttemptsKey(userId);

      const attempts = await this.client.incr(key);

      if (attempts === 1) {
        await this.client.expire(key, expiryInSeconds);
      }

      if (attempts >= maxAttempts) {
        await this.blockUser(userId, expiryInSeconds);
        logger.warn("User exceeded max OTP attempts", {
          userId,
          attempts,
          maxAttempts,
        });
        return false;
      }

      return true;
    } catch (error: unknown) {
      logger.error("Failed to increment OTP attempts", { userId, error });
      return true;
    }
  }

  async getOTPAttempts(userId: string): Promise<number> {
    try {
      await RedisSingleton.connect();
      const key = this.getAttemptsKey(userId);
      const attempts = await this.client.get(key);
      return attempts ? parseInt(attempts) : 0;
    } catch (error: unknown) {
      logger.error("Failed to get OTP attempts", { userId, error });
      return 0;
    }
  }

  async clearOTPAttempts(userId: string): Promise<void> {
    try {
      await RedisSingleton.connect();
      const key = this.getAttemptsKey(userId);
      await this.client.del(key);

      const blockKey = this.getBlockKey(userId);
      await this.client.del(blockKey);
    } catch (error: unknown) {
      logger.error("Failed to clear OTP attempts", { userId, error });
    }
  }

  async hasExceededOTPAttempts(
    userId: string,
    maxAttempts: number = this.defaultOptions.maxAttempts
  ): Promise<boolean> {
    const attempts = await this.getOTPAttempts(userId);
    return attempts >= maxAttempts;
  }

  private async blockUser(
    userId: string,
    blockingTimeInSeconds: number = this.defaultOptions.blockingTimeInSeconds
  ): Promise<void> {
    try {
      const key = this.getBlockKey(userId);
      await this.client.setEx(key, blockingTimeInSeconds, "1");
    } catch (error: unknown) {
      logger.error("Failed to block user", { userId, error });
    }
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const key = this.getBlockKey(userId);
      const blocked = await this.client.get(key);
      return !!blocked;
    } catch (error: unknown) {
      logger.error("Failed to check if user is blocked", { userId, error });
      return false;
    }
  }

  async getBlockTimeRemaining(userId: string): Promise<number | null> {
    try {
      const key = this.getBlockKey(userId);
      const ttl = await this.client.ttl(key);
      return ttl > 0 ? ttl : null;
    } catch (error: unknown) {
      logger.error("Failed to get block time remaining", { userId, error });
      return null;
    }
  }

  async unblockUser(userId: string): Promise<void> {
    try {
      const key = this.getBlockKey(userId);
      await this.client.del(key);
    } catch (error: unknown) {
      logger.error("Failed to unblock user", { userId, error });
    }
  }

  private getOTPKey(userId: string): string {
    return `otp:${userId}`;
  }

  private getAttemptsKey(userId: string): string {
    return `otp_attempts:${userId}`;
  }

  private getBlockKey(userId: string): string {
    return `otp_block:${userId}`;
  }
}
