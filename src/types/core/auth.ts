import { AuthContext, Role } from "../../../generated/prisma/client";

/**
 * JWT Token Payload
 *
 * Default auth uses id, email, role, rememberMe.
 * Optional context fields are available when implementing multi-context RBAC.
 * See src/middlewares/Auth.ts for the RBAC middleware that uses them.
 */
export interface TokenPayload {
  id: string;
  email: string;
  role: Role;
  rememberMe: boolean;
  tokenType: "ACCESS" | "REFRESH" | "VERIFY_EMAIL";
  jti: string;
  // Optional context fields — populate in generateToken() when enabling multi-context RBAC
  context?: AuthContext;
  organizationId?: string;
  organizationRole?: Role;
}
