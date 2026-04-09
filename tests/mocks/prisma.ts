// Stub for generated/prisma — used in tests so `prisma generate` is not required in CI.
// Mirrors the enums and minimal types the source code depends on at runtime.

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  MEMBER = "MEMBER",
}

export enum TokenType {
  REFRESH = "REFRESH",
  VERIFY_EMAIL = "VERIFY_EMAIL",
}

export enum AuthContext {
  PLATFORM = "PLATFORM",
  ORGANIZATION = "ORGANIZATION",
}

export const Prisma = {
  TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" },
};

// Stub PrismaClient — tests that need the DB should mock @utils/prismaClient directly.
export class PrismaClient {
  $connect = async () => {};
  $disconnect = async () => {};
  $transaction = async <T>(fn: (tx: unknown) => Promise<T>) => fn({});
}
