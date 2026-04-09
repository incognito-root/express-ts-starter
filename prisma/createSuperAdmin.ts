/**
 * Super Admin Creation Script
 *
 * This script safely creates a Super Admin account for the {{PROJECT_NAME}} platform.
 *
 * SECURITY NOTES:
 * - Credentials are read from environment variables (never hardcoded)
 * - Idempotent: checks if admin exists before creating
 * - Should only be run in secure, controlled environments
 * - Delete this script from production servers after initial setup
 *
 * USAGE:
 * 1. Set environment variables:
 *    - SUPER_ADMIN_EMAIL: The email for the super admin account
 *    - SUPER_ADMIN_PASSWORD: Strong password (min 12 chars recommended)
 *    - SUPER_ADMIN_NAME: Display name for the admin
 *
 * 2. Run the script:
 *    npx ts-node prisma/createSuperAdmin.ts
 *
 * 3. Securely store the credentials and delete any local copies
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { Role } from "../generated/prisma";
import { hashPassword } from "../src/utils/password";
import * as readline from "readline";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

// Minimum password requirements
const PASSWORD_MIN_LENGTH = 12;

interface SuperAdminCredentials {
  email: string;
  password: string;
  name: string;
}

/**
 * Validates password strength
 */
function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates email format
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Prompts user for input (for interactive mode)
 */
async function promptInput(
  question: string,
  hidden: boolean = false
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(question);
      let input = "";

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      const onData = (char: string) => {
        if (char === "\n" || char === "\r" || char === "\u0004") {
          process.stdin.setRawMode(false);
          process.stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (char === "\u0003") {
          // Ctrl+C
          process.exit();
        } else if (char === "\u007F" || char === "\b") {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question + "*".repeat(input.length));
          }
        } else {
          input += char;
          process.stdout.write("*");
        }
      };

      process.stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Gets credentials from environment variables or interactive prompt
 */
async function getCredentials(): Promise<SuperAdminCredentials> {
  const envEmail = process.env.SUPER_ADMIN_EMAIL;
  const envPassword = process.env.SUPER_ADMIN_PASSWORD;
  const envName = process.env.SUPER_ADMIN_NAME;

  // If all env vars are set, use them
  if (envEmail && envPassword && envName) {
    console.log("📋 Using credentials from environment variables");
    return {
      email: envEmail,
      password: envPassword,
      name: envName,
    };
  }

  // Interactive mode
  console.log("\n🔐 Super Admin Account Creation");
  console.log("================================");
  console.log("No environment variables found. Entering interactive mode.\n");

  const email = await promptInput("Email: ");
  const name = await promptInput("Full Name: ");
  const password = await promptInput(
    "Password (min 12 chars, mixed case, numbers, special): ",
    true
  );
  const confirmPassword = await promptInput("Confirm Password: ", true);

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  return { email, password, name };
}

/**
 * Main function to create super admin
 */
async function createSuperAdmin(): Promise<void> {
  console.log("\n🛡️  {{PROJECT_NAME}} Super Admin Creation Script");
  console.log("==========================================\n");

  try {
    // Get credentials
    const credentials = await getCredentials();

    // Validate email
    if (!validateEmail(credentials.email)) {
      throw new Error("Invalid email format");
    }

    // Validate password
    const passwordValidation = validatePassword(credentials.password);
    if (!passwordValidation.valid) {
      console.error("\n❌ Password does not meet requirements:");
      passwordValidation.errors.forEach((err) => console.error(`   - ${err}`));
      throw new Error("Password validation failed");
    }

    // Check if super admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [{ email: credentials.email }, { role: Role.SUPER_ADMIN }],
      },
    });

    if (existingAdmin) {
      if (existingAdmin.email === credentials.email) {
        console.log("\n⚠️  A user with this email already exists.");
        console.log(`   Email: ${existingAdmin.email}`);
        console.log(`   Role: ${existingAdmin.role}`);
        console.log(`   Created: ${existingAdmin.createdAt}`);

        if (existingAdmin.role === Role.SUPER_ADMIN) {
          console.log(
            "\n✅ This user is already a Super Admin. No action needed."
          );
        } else {
          console.log("\n⚠️  This user exists but is not a Super Admin.");
          console.log(
            "   If you need to upgrade this user, do it manually in the database."
          );
        }
        return;
      } else {
        console.log("\n⚠️  A Super Admin account already exists:");
        console.log(`   Email: ${existingAdmin.email}`);
        console.log(`   Name: ${existingAdmin.name}`);
        console.log(`   Created: ${existingAdmin.createdAt}`);
        console.log("\n   Only one Super Admin is allowed. Exiting.");
        return;
      }
    }

    // Hash password
    console.log("\n🔒 Hashing password...");
    const hashedPassword = await hashPassword(credentials.password);

    // Create super admin
    console.log("📝 Creating Super Admin account...");
    const superAdmin = await prisma.user.create({
      data: {
        email: credentials.email,
        password: hashedPassword,
        name: credentials.name,
        role: Role.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      },
    });

    console.log("\n✅ Super Admin created successfully!");
    console.log("=====================================");
    console.log(`   ID: ${superAdmin.id}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Name: ${superAdmin.name}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   Created: ${superAdmin.createdAt}`);
    console.log("\n⚠️  SECURITY REMINDERS:");
    console.log("   1. Store these credentials securely (password manager)");
    console.log("   2. Delete any local files containing the password");
    console.log("   3. Consider removing this script from production servers");
    console.log("   4. Enable 2FA when available");
    console.log("   5. Change password after first login in production");
  } catch (error) {
    console.error("\n❌ Failed to create Super Admin:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Run the script
createSuperAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error.message);
    process.exit(1);
  });
