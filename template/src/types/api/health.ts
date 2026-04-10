export interface HealthStatus {
  status: "healthy" | "unhealthy";
  uptime: number;
  timestamp: string;
  // @feature:bullmq
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    email: ServiceHealth;
    queue: ServiceHealth;
  };
  // @end:bullmq
  // @feature:!bullmq
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    email: ServiceHealth;
  };
  // @end:!bullmq
  version: string;
}

export interface ServiceHealth {
  status: "up" | "down";
  message?: string;
  responseTime?: number;
}
