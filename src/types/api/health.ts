export interface HealthStatus {
  status: "healthy" | "unhealthy";
  uptime: number;
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    email: ServiceHealth;
    queue: ServiceHealth;
  };
  version: string;
}

export interface ServiceHealth {
  status: "up" | "down";
  message?: string;
  responseTime?: number;
}
