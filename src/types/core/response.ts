export interface ApiResponse<T> {
  status: string;
  data: T;
  message: string;
  metadata?: Record<string, any>;
}

export interface CookieOptions {
  name: string;
  value: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
}
