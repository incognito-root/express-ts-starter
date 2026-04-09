import supertest from "supertest";
import { getCsrfToken } from "./csrf";

interface LoginResult {
  csrfToken: string;
  body: Record<string, unknown>;
}

/**
 * Log in as the given user and return the CSRF token for subsequent requests.
 * The agent's cookie jar is populated with accessToken + refreshToken.
 */
export async function loginUser(
  agent: ReturnType<typeof supertest.agent>,
  email: string,
  password: string,
  rememberMe = false
): Promise<LoginResult> {
  const { csrfToken } = await getCsrfToken(agent);

  const res = await agent
    .post("/v1/auth/login")
    .set("X-CSRF-Token", csrfToken)
    .send({ email, password, rememberMe })
    .expect(200);

  return { csrfToken, body: res.body as Record<string, unknown> };
}
