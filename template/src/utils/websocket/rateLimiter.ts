import logger from "../logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterConfig {
  points: number;
  duration: number;
  blockDuration?: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  points: 20,
  duration: 1,
  blockDuration: 60,
};

class WebSocketRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private blocked: Map<string, number> = new Map();
  private config: RateLimiterConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      for (const [key, entry] of this.limits.entries()) {
        if (entry.resetAt < now) {
          this.limits.delete(key);
        }
      }

      for (const [key, unblockAt] of this.blocked.entries()) {
        if (unblockAt < now) {
          this.blocked.delete(key);
        }
      }
    }, 60000);
  }

  consume(key: string): { allowed: boolean; remainingPoints: number } {
    const now = Date.now();

    const unblockAt = this.blocked.get(key);
    if (unblockAt && unblockAt > now) {
      return { allowed: false, remainingPoints: 0 };
    }

    let entry = this.limits.get(key);

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + this.config.duration * 1000,
      };
      this.limits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > this.config.points) {
      if (this.config.blockDuration) {
        this.blocked.set(key, now + this.config.blockDuration * 1000);
        logger.warn("WebSocket client blocked for rate limiting", { key });
      }
      return { allowed: false, remainingPoints: 0 };
    }

    return {
      allowed: true,
      remainingPoints: this.config.points - entry.count,
    };
  }

  isBlocked(key: string): boolean {
    const unblockAt = this.blocked.get(key);
    if (unblockAt && unblockAt > Date.now()) {
      return true;
    }
    return false;
  }

  reset(key: string): void {
    this.limits.delete(key);
    this.blocked.delete(key);
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.limits.clear();
    this.blocked.clear();
  }
}

export const wsRateLimiter = new WebSocketRateLimiter({
  points: 30,
  duration: 1,
  blockDuration: 60,
});

export const wsSubscribeRateLimiter = new WebSocketRateLimiter({
  points: 10,
  duration: 1,
  blockDuration: 30,
});
