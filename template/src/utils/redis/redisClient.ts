import { createClient, RedisClientType } from "redis";

import { getEnv } from "../../config/env";
import logger from "../logger";

class RedisSingleton {
  private static instance: RedisSingleton;
  private client: RedisClientType | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: number = 5000;
  private reconnecting: boolean = false;

  // Private constructor: does nothing — client creation is deferred to
  // getOrCreateClient() so that getEnv() / dotenv is resolved first.
  private constructor() {}

  private getOrCreateClient(): RedisClientType {
    if (!this.client) {
      const env = getEnv();
      this.client = createClient({
        url: env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries >= this.maxReconnectAttempts) {
              logger.error("Max Redis reconnection attempts reached");
              return new Error("Max Redis reconnection attempts reached");
            }

            const delay = Math.min(retries * this.reconnectInterval, 30000);
            logger.info(
              `Retrying Redis connection in ${delay}ms, attempt ${retries}`
            );
            return delay;
          },
        },
      }) as RedisClientType;

      this.setupEventListeners();
    }
    return this.client;
  }

  private setupEventListeners(): void {
    const client = this.getOrCreateClient();
    client.on("error", (err: Error) => {
      logger.error("Redis Client Error", {
        error: err.message,
        stack: err.stack,
      });
    });

    client.on("connect", () => {
      logger.info("Redis client connected");
      this.reconnectAttempts = 0;
      this.reconnecting = false;
    });

    client.on("reconnecting", () => {
      this.reconnecting = true;
      logger.info(
        `Redis client reconnecting, attempt ${++this.reconnectAttempts}`
      );
    });

    client.on("end", () => {
      logger.info("Redis client connection closed");
    });
  }

  public static getInstance(): RedisSingleton {
    if (!RedisSingleton.instance) {
      RedisSingleton.instance = new RedisSingleton();
    }
    return RedisSingleton.instance;
  }

  public getClient() {
    return this.getOrCreateClient();
  }

  public async connect() {
    const client = this.getOrCreateClient();
    if (!client.isOpen && !this.reconnecting) {
      try {
        await client.connect();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Failed to connect to Redis", {
          error: err.message,
          stack: err.stack,
        });
        throw error;
      }
    }
  }

  public async disconnect() {
    if (this.client?.isOpen) {
      try {
        await this.client.quit();
        logger.info("Redis client successfully disconnected");
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Failed to disconnect Redis client", {
          error: err.message,
          stack: err.stack,
        });
        await this.client.disconnect();
      }
    }
  }

  public async ping(): Promise<boolean> {
    try {
      const response = await this.getOrCreateClient().ping();
      return response === "PONG";
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Redis ping failed", {
        error: err.message,
      });
      return false;
    }
  }
}

export default RedisSingleton.getInstance();
