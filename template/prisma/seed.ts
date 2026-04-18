import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Role } from "../generated/prisma/enums";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../src/utils/password";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  if (process.env.NODE_ENV === "development") {
    console.log("🧹 Cleaning existing data...");
    await prisma.organizationMember.deleteMany();
    await prisma.token.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  }

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: "default-org" },
    update: {},
    create: {
      name: "Default Organization",
      slug: "default-org",
      isActive: true,
    },
  });
  console.log(`✅ Organization: ${org.name} (${org.id})`);

  // Create super admin user
  const superAdminPassword = await hashPassword("SuperAdmin@123");

  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: superAdminPassword,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      isVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ Super Admin: ${superAdmin.email} (${superAdmin.id})`);

  // Add super admin as OWNER of default org
  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: superAdmin.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: superAdmin.id,
      organizationId: org.id,
      role: Role.OWNER,
    },
  });
  console.log(`✅ Membership: ${superAdmin.email} → ${org.name} (OWNER)`);

  console.log("\n🎉 Seeding complete!");
  console.log("   Default credentials:");
  console.log("   Email:    admin@example.com");
  console.log("   Password: SuperAdmin@123");
  console.log("   ⚠️  Change these before deploying to production!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error("Seeding failed:", error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
