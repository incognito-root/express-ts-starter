import { LiveServer, LiveSocket } from "../../types/websocket";

export { handleConnection } from "./connectionHandler";

/**
 * Register your domain-specific Socket.IO handlers here.
 *
 * This function is called once per connection in websocket/index.ts.
 * Create handler files (e.g., chatHandler.ts, notificationHandler.ts)
 * and import + call them here.
 *
 * @example
 * import { registerChatHandlers } from "./chatHandler";
 * import { registerNotificationHandlers } from "./notificationHandler";
 *
 * export function registerHandlers(io: LiveServer, socket: LiveSocket): void {
 *   registerChatHandlers(io, socket);
 *   registerNotificationHandlers(io, socket);
 * }
 *
 * See EXTENDING.md for a complete guide.
 */
export function registerHandlers(
  _io: LiveServer,
  _socket: LiveSocket
): void {
  // Add your handler registrations here
}
