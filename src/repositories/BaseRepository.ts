import { Prisma } from "../../generated/prisma/client";
import prisma from "../utils/prismaClient";

export abstract class BaseRepository<_TModel> {
  // Marker class for repository pattern consistency
  // Child repositories should implement their own typed methods using prisma directly
}

export async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(callback, {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}
