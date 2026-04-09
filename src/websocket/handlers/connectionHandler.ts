import { LiveServer, LiveSocket } from "../../types/websocket";
import logger from "../../utils/logger";

export const handleConnection = (io: LiveServer, socket: LiveSocket): void => {
  const { userId, userEmail, userRole, isAuthenticated, authExpired } =
    socket.data;

  logger.info("WebSocket client connected", {
    socketId: socket.id,
    userId: userId ?? "anonymous",
    isAuthenticated,
    authExpired: authExpired ?? false,
    role: userRole ?? "none",
  });

  if (authExpired) {
    socket.emit("auth:expired");
    logger.info("Emitted auth:expired to client", { socketId: socket.id });
  }

  socket.on("disconnect", (reason) => {
    handleDisconnect(socket, reason);
  });

  socket.on("error", (error) => {
    logger.error("WebSocket error", {
      socketId: socket.id,
      userId,
      error: error.message,
    });
  });

  if (isAuthenticated) {
    logger.debug("Authenticated user connected to WebSocket", {
      socketId: socket.id,
      userId,
      email: userEmail,
      role: userRole,
    });
  }
};

const handleDisconnect = (socket: LiveSocket, reason: string): void => {
  const { userId } = socket.data;

  logger.info("WebSocket client disconnected", {
    socketId: socket.id,
    userId: userId ?? "anonymous",
    reason,
  });
};

export const getConnectedClientsCount = async (
  io: LiveServer
): Promise<number> => {
  const sockets = await io.fetchSockets();
  return sockets.length;
};

export const getAuthenticatedClientsCount = async (
  io: LiveServer
): Promise<number> => {
  const sockets = await io.fetchSockets();
  return sockets.filter((s) => s.data.isAuthenticated).length;
};

export const getRoomSize = async (
  io: LiveServer,
  room: string
): Promise<number> => {
  const sockets = await io.in(room).fetchSockets();
  return sockets.length;
};
