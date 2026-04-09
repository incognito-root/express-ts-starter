#!/usr/bin/env node
/**
 * express-ts-starter init script
 *
 * Run once after cloning to configure your project:
 *   node scripts/init.js
 *
 * What it does:
 *   1. Prompts for project name, production URL, and database name
 *   2. Replaces placeholder tokens throughout the project
 *   3. Copies .env.example → .env
 *   4. Self-deletes
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ROOT = path.resolve(__dirname, "..");

// All placeholder tokens
const PLACEHOLDERS = {
  "{{PROJECT_NAME}}": null,       // e.g. "MyApp"
  "{{PROJECT_NAME_LOWER}}": null, // e.g. "myapp"
  "{{PRODUCTION_URL}}": null,     // e.g. "https://api.myapp.com"
  "{{DB_NAME}}": null,            // e.g. "myapp_db"
};

// Skip these paths when replacing
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "generated",
  "coverage",
  ".husky/_",
]);

const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".ico", ".woff", ".woff2", ".ttf", ".eot",
  ".zip", ".gz", ".tar",
]);

// ────────────────────────────────────────────────────────────────
// Prompt helper
// ────────────────────────────────────────────────────────────────
function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ────────────────────────────────────────────────────────────────
// Recursively walk and replace in all text files
// ────────────────────────────────────────────────────────────────
function replaceInFile(filePath, replacements) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return; // binary file or unreadable — skip
  }

  let updated = content;
  for (const [token, value] of Object.entries(replacements)) {
    // Replace all occurrences
    updated = updated.split(token).join(value);
  }

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, "utf8");
  }
}

function walkAndReplace(dir, replacements) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkAndReplace(fullPath, replacements);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SKIP_EXTENSIONS.has(ext)) {
        replaceInFile(fullPath, replacements);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 express-ts-starter — Project Initializer");
  console.log("============================================\n");

  // Gather inputs
  let projectName;
  while (!projectName) {
    projectName = await prompt("Project name? (e.g. MyApp): ");
    if (!projectName) console.log("  ⚠️  Project name cannot be empty.");
  }

  const productionUrl =
    (await prompt("Production API URL? (e.g. https://api.myapp.com): ")) ||
    "https://api.example.com";

  const dbName =
    (await prompt("Database name? (e.g. myapp_db): ")) ||
    projectName.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_db";

  const projectNameLower = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const replacements = {
    "{{PROJECT_NAME}}": projectName,
    "{{PROJECT_NAME_LOWER}}": projectNameLower,
    "{{PRODUCTION_URL}}": productionUrl,
    "{{DB_NAME}}": dbName,
  };

  console.log("\n🔄 Replacing placeholders...");
  walkAndReplace(ROOT, replacements);
  console.log("  ✓ Placeholders replaced");

  // Copy .env.example → .env
  const envExamplePath = path.join(ROOT, ".env.example");
  const envPath = path.join(ROOT, ".env");

  if (fs.existsSync(envExamplePath)) {
    if (!fs.existsSync(envPath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log("  ✓ .env created from .env.example");
    } else {
      console.log("  ⚠️  .env already exists — skipping copy");
    }
  }

  // Self-delete this script
  try {
    fs.unlinkSync(__filename);
    console.log("  ✓ init script removed\n");
  } catch {
    console.log("  ⚠️  Could not remove init script (remove it manually)\n");
  }

  console.log("✅ Project initialized as: " + projectName);
  console.log("\nNext steps:");
  console.log("  1. Open .env and fill in your secrets:");
  console.log("       DATABASE_URL, JWT_SECRET, REDIS_URL, EMAIL_* etc.");
  console.log("  2. npm install");
  console.log("  3. npx prisma migrate dev --name init");
  console.log("  4. npm run dev\n");
}

main().catch((err) => {
  console.error("Init failed:", err.message);
  process.exit(1);
});
