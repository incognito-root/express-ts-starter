/**
 * WebSocket event interfaces.
 *
 * Add your domain-specific events here.
 * See docs/EXTENDING.md for guidance.
 */

export interface ClientToServerEvents {
  // Add your client → server events here
  // Example: "room:join": (payload: { roomId: string }) => void;
}

export interface ServerToClientEvents {
  "auth:expired": () => void;
  // Add your server → client events here
  // Example: "notification": (payload: { message: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  isAuthenticated: boolean;
  authExpired?: boolean;
}
