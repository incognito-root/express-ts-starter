import path from "node:path";
import fs from "node:fs/promises";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "generated",
  "coverage",
]);

const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".ico", ".woff", ".woff2", ".ttf", ".eot",
  ".zip", ".gz", ".tar",
]);

/**
 * Walk all text files and replace placeholder tokens.
 */
export async function replacePlaceholders(
  projectDir: string,
  replacements: Record<string, string>
): Promise<void> {
  await walkAndReplace(projectDir, replacements);
}

async function walkAndReplace(
  dir: string,
  replacements: Record<string, string>
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walkAndReplace(fullPath, replacements);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SKIP_EXTENSIONS.has(ext)) {
        await replaceInFile(fullPath, replacements);
      }
    }
  }
}

async function replaceInFile(
  filePath: string,
  replacements: Record<string, string>
): Promise<void> {
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    return;
  }

  let updated = content;
  for (const [token, value] of Object.entries(replacements)) {
    updated = updated.split(token).join(value);
  }

  if (updated !== content) {
    await fs.writeFile(filePath, updated, "utf-8");
  }
}
