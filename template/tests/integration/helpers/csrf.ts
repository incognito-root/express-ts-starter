import supertest from "supertest";

/**
 * Fetch a CSRF token from the app.
 * Returns the token string and raw cookie headers to forward on subsequent requests.
 */
export async function getCsrfToken(
  agent: ReturnType<typeof supertest.agent>
): Promise<{ csrfToken: string }> {
  const res = await agent.get("/v1/auth/csrf-token").expect(200);

  const csrfToken: string =
    (res.body as { csrfToken?: string }).csrfToken ?? "";
  // The agent automatically persists the _csrf and XSRF-TOKEN cookies.
  return { csrfToken };
}
