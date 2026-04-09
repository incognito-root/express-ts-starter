import cookie from "cookie";
import { Socket } from "socket.io";

import { ERROR_MESSAGES } from "../../constants/errorMessages";
import * as authService from "../../services/authService";
import { TokenPayload } from "../../types";
import {
  SocketData,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
} from "../../types/websocket";
import logger from "../../utils/logger";

type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const parseCookies = (
  cookieHeader: string | undefined
): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookie.parse(cookieHeader);
};

const setUnauthenticated = (socket: AuthenticatedSocket): void => {
  socket.data.isAuthenticated = false;
  socket.data.userId = null;
  socket.data.userEmail = null;
  socket.data.userName = null;
  socket.data.userRole = null;
};

export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): Promise<void> => {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const accessToken = cookies.accessToken;

  if (!accessToken) {
    setUnauthenticated(socket);
    logger.info(
      "WebSocket connection without authentication (no accessToken cookie)",
      {
        socketId: socket.id,
        ip: socket.handshake.address,
      }
    );
    return next();
  }

  try {
    const decoded: TokenPayload = await authService.validateToken(
      accessToken,
      "ACCESS"
    );

    socket.data.isAuthenticated = true;
    socket.data.userId = decoded.id;
    socket.data.userEmail = decoded.email;
    socket.data.userName = decoded.email.split("@")[0];
    socket.data.userRole = decoded.role;

    logger.info("WebSocket authenticated connection", {
      socketId: socket.id,
      userId: decoded.id,
      role: decoded.role,
    });

    next();
  } catch {
    setUnauthenticated(socket);
    socket.data.authExpired = true;

    logger.info("WebSocket connection with expired/invalid token", {
      socketId: socket.id,
    });

    next();
  }
};

/**
 * Guard: require socket to be authenticated.
 * The callback is only invoked if the user is authenticated.
 * Otherwise, `auth:expired` is emitted to prompt re-login.
 */
export const requireAuth = (
  socket: AuthenticatedSocket,
  callback: () => void
): void => {
  if (!socket.data.isAuthenticated) {
    socket.emit("auth:expired");
    logger.warn(ERROR_MESSAGES.WS_AUTH_REQUIRED, { socketId: socket.id });
    return;
  }
  callback();
};

/**
 * Guard: require socket to have one of the specified roles.
 * Calls requireAuth first, then checks the role.
 */
export const requireRole = (
  socket: AuthenticatedSocket,
  allowedRoles: string[],
  callback: () => void
): void => {
  requireAuth(socket, () => {
    if (!socket.data.userRole || !allowedRoles.includes(socket.data.userRole)) {
      logger.warn(ERROR_MESSAGES.WS_INSUFFICIENT_PERMISSIONS, {
        socketId: socket.id,
        userRole: socket.data.userRole,
        allowedRoles,
      });
      return;
    }
    callback();
  });
};
