import { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { getEnv } from "../config/env";
import { ERROR_MESSAGES } from "../constants/errorMessages";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  LiveServer,
} from "../types/websocket";
import logger from "../utils/logger";
import {
  wsRateLimiter,
  wsSubscribeRateLimiter,
} from "../utils/websocket/rateLimiter";

import { handleConnection, registerHandlers } from "./handlers";
import { socketAuthMiddleware } from "./middleware";

export type { LiveServer };

let io: LiveServer | null = null;

const MAX_PAYLOAD_SIZE = 10 * 1024;

export const initializeWebSocketServer = (
  httpServer: HttpServer
): LiveServer => {
  const env = getEnv();

  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: MAX_PAYLOAD_SIZE,
  });

  io.use((socket, next) => {
    void socketAuthMiddleware(socket, next);
  });

  io.use((socket, next) => {
    socket.onAny((event: string, ...args: unknown[]) => {
      const payloadSize = JSON.stringify(args).length;
      if (payloadSize > MAX_PAYLOAD_SIZE) {
        logger.warn("WebSocket payload too large", {
          socketId: socket.id,
          event,
          size: payloadSize,
          message: ERROR_MESSAGES.WS_PAYLOAD_TOO_LARGE,
        });
        socket.disconnect(true);
        return;
      }

      const { allowed } = wsRateLimiter.consume(socket.id);
      if (!allowed) {
        logger.warn("WebSocket rate limit exceeded", {
          socketId: socket.id,
          event,
          message: ERROR_MESSAGES.WS_TOO_MANY_REQUESTS,
        });
        return;
      }
    });
    next();
  });

  io.on("connection", (socket) => {
    handleConnection(io!, socket);
    registerHandlers(io!, socket);
  });

  logger.info(
    "WebSocket server initialized with rate limiting and payload size limits"
  );

  return io;
};

export const getWebSocketServer = (): LiveServer | null => {
  return io;
};

export { wsRateLimiter, wsSubscribeRateLimiter };

export const shutdownWebSocketServer = async (): Promise<void> => {
  if (io) {
    logger.info("Shutting down WebSocket server...");

    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    wsRateLimiter.shutdown();
    wsSubscribeRateLimiter.shutdown();

    const server = io;
    io = null;

    await server.close();
    logger.info("WebSocket server closed");
  }
};
