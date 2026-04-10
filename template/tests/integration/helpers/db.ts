import bcrypt from "bcrypt";
import prisma from "../../../src/utils/prismaClient";

const SALT_ROUNDS = 12;

export interface TestUserOptions {
  email?: string;
  password?: string;
  name?: string;
  role?: "SUPER_ADMIN" | "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";
  isVerified?: boolean;
  isActive?: boolean;
}

const defaults: Required<TestUserOptions> = {
  email: "test@example.com",
  password: "TestPass@123",
  name: "Test User",
  role: "MEMBER",
  isVerified: true,
  isActive: true,
};

/**
 * Seed a user directly into the database with a bcrypt-hashed password.
 * Returns the created user record (with id).
 */
export async function seedTestUser(opts?: TestUserOptions) {
  const o = { ...defaults, ...opts };
  const hashedPassword = await bcrypt.hash(o.password, SALT_ROUNDS);

  return prisma.user.create({
    data: {
      email: o.email,
      password: hashedPassword,
      name: o.name,
      role: o.role,
      isVerified: o.isVerified,
      isActive: o.isActive,
    },
  });
}

/**
 * Truncate all tables in dependency order.
 * Called between test files to ensure isolation.
 */
export async function cleanDatabase() {
  await prisma.token.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
}
