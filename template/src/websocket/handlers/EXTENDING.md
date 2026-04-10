# Extending the WebSocket Layer

## Overview

The WebSocket layer is built on Socket.IO 4. All domain-specific handlers live in
`src/websocket/handlers/`. The `registerHandlers` function in `handlers/index.ts`
is the single entry point called for each new connection.

---

## Adding a New Handler

### 1. Define Events

Add your event signatures to `src/types/websocket/events.ts`:

```ts
export interface ClientToServerEvents {
  "chat:send": (payload: { roomId: string; message: string }) => void;
}

export interface ServerToClientEvents {
  "auth:expired": () => void;
  "chat:message": (payload: { userId: string; message: string; timestamp: string }) => void;
}
```

### 2. Create a Handler File

```ts
// src/websocket/handlers/chatHandler.ts
import { LiveServer, LiveSocket } from "../../types/websocket";
import { requireAuth } from "../middleware";

export function registerChatHandlers(io: LiveServer, socket: LiveSocket): void {
  socket.on("chat:send", (payload) => {
    requireAuth(socket, () => {
      io.to(`room:${payload.roomId}`).emit("chat:message", {
        userId: socket.data.userId!,
        message: payload.message,
        timestamp: new Date().toISOString(),
      });
    });
  });
}
```

### 3. Register in `handlers/index.ts`

```ts
import { registerChatHandlers } from "./chatHandler";

export function registerHandlers(io: LiveServer, socket: LiveSocket): void {
  registerChatHandlers(io, socket);
}
```

---

## Auth Guards

Two guards are exported from `src/websocket/middleware/socketAuth.ts`:

| Guard | Usage |
|---|---|
| `requireAuth(socket, cb)` | Ensures socket is authenticated, emits `auth:expired` if not |
| `requireRole(socket, roles, cb)` | Ensures socket has one of the given roles |

---

## SocketData

`socket.data` is typed as `SocketData` (defined in `src/types/websocket/events.ts`).
Available fields after authentication:
- `isAuthenticated: boolean`
- `userId: string | null`
- `userEmail: string | null`
- `userRole: string | null`
- `authExpired?: boolean`

---

## Utility Helpers

In `src/websocket/handlers/connectionHandler.ts`:
- `getConnectedClientsCount(io)` — total connected sockets
- `getAuthenticatedClientsCount(io)` — authenticated sockets only
- `getRoomSize(io, room)` — number of sockets in a room
