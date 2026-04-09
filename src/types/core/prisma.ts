import { PrismaClient } from "../../../generated/prisma/client";

/**
 * Prisma Transaction Client type
 * Used to pass transaction context to repository methods for atomic operations
 *
 * @example
 * ```typescript
 * async create(data: CreateDTO, tx?: PrismaTransactionClient) {
 *   const client = tx ?? prisma;
 *   return client.model.create({ data });
 * }
 * ```
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
