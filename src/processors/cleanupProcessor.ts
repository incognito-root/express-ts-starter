import path from "node:path";
import fs from "node:fs/promises";

import fsExtra from "fs-extra";

/**
 * Post-generation cleanup:
 * - Rename _gitignore -> .gitignore,  _env.example -> .env.example (if still present)
 * - Copy .env.example -> .env
 * - Remove empty directories
 * - Set up husky hooks with branch protection
 */
export async function cleanup(projectDir: string): Promise<void> {
  // Rename dotfiles (npm strips .gitignore from packages)
  await safeRename(
    path.join(projectDir, "_gitignore"),
    path.join(projectDir, ".gitignore")
  );
  // _env.example and _package.json should already be handled by envBuilder/packageJsonBuilder
  // but handle them defensively
  await safeRename(
    path.join(projectDir, "_env.example"),
    path.join(projectDir, ".env.example")
  );
  await safeRename(
    path.join(projectDir, "_package.json"),
    path.join(projectDir, "package.json")
  );

  // Copy .env.example -> .env
  const envExample = path.join(projectDir, ".env.example");
  const envFile = path.join(projectDir, ".env");
  if (await fileExists(envExample)) {
    await fs.copyFile(envExample, envFile);
  }

  // Write husky hooks with branch protection
  await writeHuskyHooks(projectDir);

  // Remove empty directories (bottom-up)
  await removeEmptyDirs(projectDir);
}

async function safeRename(from: string, to: string): Promise<void> {
  try {
    if (await fileExists(from)) {
      await fs.rename(from, to);
    }
  } catch {
    // ignore
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeHuskyHooks(projectDir: string): Promise<void> {
  const huskyDir = path.join(projectDir, ".husky");
  if (!(await fileExists(huskyDir))) return;

  const prePushContent = [
    "#!/usr/bin/env sh",
    '. "$(dirname -- "$0")/_/husky.sh"',
    "",
    "# Block direct pushes to main/master",
    'current_branch=$(git rev-parse --abbrev-ref HEAD)',
    "",
    'if [ "$current_branch" = "master" ] || [ "$current_branch" = "main" ]; then',
    '  echo ""',
    '  echo "ERROR: Cannot push directly to \'$current_branch\' branch"',
    '  echo "Please use a feature branch and create a pull request instead."',
    '  echo ""',
    "  exit 1",
    "fi",
    "",
    "exit 0",
  ].join("\n") + "\n";

  const preCommitContent = [
    "#!/usr/bin/env sh",
    '. "$(dirname -- "$0")/_/husky.sh"',
    "",
    "# Block direct commits to main/master",
    'current_branch=$(git rev-parse --abbrev-ref HEAD)',
    "",
    'if [ "$current_branch" = "master" ] || [ "$current_branch" = "main" ]; then',
    '  echo ""',
    '  echo "ERROR: Cannot commit directly to \'$current_branch\' branch"',
    '  echo "Please use a feature branch instead."',
    '  echo ""',
    "  exit 1",
    "fi",
    "",
    "# Run lint-staged",
    "npx lint-staged",
  ].join("\n") + "\n";

  await fs.writeFile(path.join(huskyDir, "pre-push"), prePushContent, {
    mode: 0o755,
  });
  await fs.writeFile(path.join(huskyDir, "pre-commit"), preCommitContent, {
    mode: 0o755,
  });
}

async function removeEmptyDirs(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const skipNames = new Set(["node_modules", ".git"]);

  let isEmpty = true;

  for (const entry of entries) {
    if (skipNames.has(entry.name)) {
      isEmpty = false;
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subEmpty = await removeEmptyDirs(fullPath);
      if (subEmpty) {
        await fs.rmdir(fullPath);
      } else {
        isEmpty = false;
      }
    } else {
      isEmpty = false;
    }
  }

  return isEmpty;
}
