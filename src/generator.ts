import { execSync } from "node:child_process";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { FEATURES } from "./features.js";
import { copyTemplate } from "./processors/templateCopier.js";
import { stripMarkers } from "./processors/markerStripper.js";
import { buildPackageJson } from "./processors/packageJsonBuilder.js";
import { buildEnv } from "./processors/envBuilder.js";
import { replacePlaceholders } from "./processors/placeholderReplacer.js";
import { cleanup } from "./processors/cleanupProcessor.js";
import type { GeneratorOptions, FeatureName } from "./types.js";

export async function generate(options: GeneratorOptions): Promise<void> {
  const { projectDir, features } = options;
  const disabledFeatures = FEATURES.filter(
    (f) => !features.includes(f.name)
  ).map((f) => f.name);
  const enabledFeatures = features;

  const s = p.spinner();

  // Step 1: Copy template
  s.start("Copying template files");
  await copyTemplate(options.projectDir, disabledFeatures);
  s.stop("Template files copied");

  // Step 2: Strip feature markers
  s.start("Configuring selected features");
  await stripMarkers(projectDir, disabledFeatures, enabledFeatures);
  s.stop("Features configured");

  // Step 3: Build package.json
  s.start("Building package.json");
  await buildPackageJson(projectDir, disabledFeatures);
  s.stop("package.json built");

  // Step 4: Build .env.example
  s.start("Building environment config");
  await buildEnv(projectDir, disabledFeatures, enabledFeatures);
  s.stop("Environment config built");

  // Step 5: Replace placeholders
  s.start("Replacing placeholders");
  const projectNameLower = options.projectName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  await replacePlaceholders(projectDir, {
    "{{PROJECT_NAME}}": options.projectName,
    "{{PROJECT_NAME_LOWER}}": projectNameLower,
    "{{PRODUCTION_URL}}": options.productionUrl,
    "{{DB_NAME}}": options.dbName,
  });
  s.stop("Placeholders replaced");

  // Step 6: Cleanup
  s.start("Cleaning up");
  await cleanup(projectDir);
  s.stop("Cleanup done");

  // Step 7: Git init
  if (options.initGit) {
    s.start("Initializing git repository");
    try {
      execSync("git init", { cwd: projectDir, stdio: "ignore" });
      execSync("git add -A", { cwd: projectDir, stdio: "ignore" });
      execSync('git commit -m "Initial commit from create-express-ts-starter"', {
        cwd: projectDir,
        stdio: "ignore",
      });
      s.stop("Git repository initialized");
    } catch {
      s.stop("Git init failed (git may not be installed)");
    }
  }

  // Step 8: Install dependencies
  if (options.installDeps) {
    s.start("Installing dependencies (this may take a minute)");
    try {
      execSync("npm install", { cwd: projectDir, stdio: "ignore", timeout: 300000 });
      s.stop("Dependencies installed");
    } catch {
      s.stop("npm install failed — run it manually");
    }
  }

  // Done!
  const relativePath = projectDir.startsWith(process.cwd())
    ? projectDir.slice(process.cwd().length + 1)
    : projectDir;

  p.note(
    [
      `cd ${relativePath}`,
      ...(options.installDeps ? [] : ["npm install"]),
      "# Fill in your .env secrets",
      "npx prisma migrate dev --name init",
      "npm run dev",
    ].join("\n"),
    "Next steps"
  );

  const featureList =
    features.length === 0
      ? "none (minimal)"
      : features.join(", ");
  p.outro(
    `${pc.green("Done!")} Created ${pc.bold(options.projectName)} with features: ${featureList}`
  );
}
