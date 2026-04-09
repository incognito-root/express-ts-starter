import { Request } from "express";

export interface RequestWithId extends Request {
  id: string;
}

// Re-export typed request helpers for convenience
export * from "./typedRequest";
