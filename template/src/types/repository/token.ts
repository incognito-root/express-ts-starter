import { TokenType } from "../../../generated/prisma/enums";

/**
 * Data Transfer Object for creating a new token
 */
export interface CreateTokenDTO {
  token: string;
  userId: string;
  expiresAt: Date;
  type: TokenType;
}
