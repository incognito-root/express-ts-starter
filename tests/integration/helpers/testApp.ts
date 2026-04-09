import supertest from "supertest";
import { createApp } from "../../../src/createApp";
import RedisSingleton from "../../../src/utils/redis/redisClient";

let agent: ReturnType<typeof supertest.agent>;

/**
 * Returns a supertest agent backed by the Express app.
 * Connects Redis on first call (lazy). The agent persists cookies across requests.
 */
export async function getTestAgent() {
  if (!agent) {
    await RedisSingleton.connect();
    const app = createApp();
    agent = supertest.agent(app);
  }
  return agent;
}

/**
 * Reset the agent (e.g. to clear cookies between test suites).
 */
export function resetAgent() {
  agent = undefined as unknown as ReturnType<typeof supertest.agent>;
}

/**
 * Disconnect Redis. Call once in afterAll of the last suite (or globalTeardown handles it).
 */
export async function disconnectServices() {
  try {
    await RedisSingleton.disconnect();
  } catch {
    // ignore
  }
}
