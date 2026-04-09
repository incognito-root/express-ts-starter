import { Token, TokenType } from "../../generated/prisma";
import { PrismaTransactionClient } from "../types";
import { CreateTokenDTO } from "../types/repository/token";
import prisma from "../utils/prismaClient";

import { BaseRepository } from "./BaseRepository";

export class TokenRepository extends BaseRepository<Token> {
  async findByToken(token: string, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.token.findUnique({
      where: { token },
    });
  }

  async createToken(data: CreateTokenDTO, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.token.create({
      data,
    });
  }

  async deleteByToken(token: string, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.token.deleteMany({
      where: { token },
    });
  }

  async deleteExpiredTokens(tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.token.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  async deleteByUserIdAndType(
    userId: string,
    type: TokenType,
    tx?: PrismaTransactionClient
  ) {
    const client = tx ?? prisma;
    return client.token.deleteMany({
      where: {
        userId,
        type,
      },
    });
  }

  async findByUserIdAndType(
    userId: string,
    type: TokenType,
    tx?: PrismaTransactionClient
  ) {
    const client = tx ?? prisma;
    return client.token.findMany({
      where: {
        userId,
        type,
      },
    });
  }
}
