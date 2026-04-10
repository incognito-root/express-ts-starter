import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

import { RequestWithId } from "../types";
import { runWithRequestId } from "../utils/requestContext";

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req.headers["x-request-id"] as string) || uuidv4();
  (req as RequestWithId).id = requestId;
  res.setHeader("X-Request-ID", requestId);
  runWithRequestId(requestId, next);
};
