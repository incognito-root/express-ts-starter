import path from "node:path";
import fs from "node:fs/promises";

import type { FeatureName } from "../types.js";

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".js",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".sh",
  ".env",
  ".example",
  ".hbs",
  ".html",
  ".css",
  ".sql",
  ".prisma",
  ".txt",
  "",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "generated",
  "coverage",
]);

/**
 * Strip `// @feature:X ... // @end:X` and `# @feature:X ... # @end:X` blocks
 * from files in the project directory.
 *
 * For disabled features: remove their `@feature:X` blocks, keep their `@feature:!X` blocks (sans markers).
 * For enabled features: keep their `@feature:X` blocks (sans markers), remove their `@feature:!X` blocks.
 */
export async function stripMarkers(
  projectDir: string,
  disabledFeatures: FeatureName[],
  enabledFeatures: FeatureName[]
): Promise<void> {
  await walkAndStrip(projectDir, disabledFeatures, enabledFeatures);
}

async function walkAndStrip(
  dir: string,
  disabledFeatures: FeatureName[],
  enabledFeatures: FeatureName[]
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walkAndStrip(fullPath, disabledFeatures, enabledFeatures);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      // Also handle dotfiles like .env.example
      const isDotfile = entry.name.startsWith("_") || entry.name.startsWith(".");
      if (TEXT_EXTENSIONS.has(ext) || isDotfile) {
        await processFile(fullPath, disabledFeatures, enabledFeatures);
      }
    }
  }
}

async function processFile(
  filePath: string,
  disabledFeatures: FeatureName[],
  enabledFeatures: FeatureName[]
): Promise<void> {
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    return;
  }

  // Only process if file contains markers
  if (!content.includes("@feature:") && !content.includes("@end:")) {
    return;
  }

  let updated = content;

  // For disabled features: strip @feature:X blocks (keep @feature:!X content)
  for (const feature of disabledFeatures) {
    // Remove @feature:X ... @end:X blocks entirely
    updated = stripBlock(updated, feature, "//");
    updated = stripBlock(updated, feature, "#");

    // Keep @feature:!X ... @end:!X content (just remove the marker lines)
    updated = unwrapBlock(updated, `!${feature}`, "//");
    updated = unwrapBlock(updated, `!${feature}`, "#");
  }

  // For enabled features: keep @feature:X content (remove markers), strip @feature:!X blocks
  for (const feature of enabledFeatures) {
    // Remove @feature:!X ... @end:!X blocks entirely
    updated = stripBlock(updated, `!${feature}`, "//");
    updated = stripBlock(updated, `!${feature}`, "#");

    // Keep @feature:X ... @end:X content (just remove the marker lines)
    updated = unwrapBlock(updated, feature, "//");
    updated = unwrapBlock(updated, feature, "#");
  }

  // Clean up triple+ blank lines
  updated = updated.replace(/\n{3,}/g, "\n\n");

  if (updated !== content) {
    await fs.writeFile(filePath, updated, "utf-8");
  }
}

/** Remove an entire @feature block including its content */
function stripBlock(
  content: string,
  featureName: string,
  commentPrefix: string
): string {
  const escaped = escapeRegex(commentPrefix);
  const escapedFeature = escapeRegex(featureName);
  const regex = new RegExp(
    `^[ \\t]*${escaped}\\s*@feature:${escapedFeature}\\s*\\n[\\s\\S]*?^[ \\t]*${escaped}\\s*@end:${escapedFeature}\\s*\\n?`,
    "gm"
  );
  return content.replace(regex, "");
}

/** Keep the content of a @feature block but remove the marker lines */
function unwrapBlock(
  content: string,
  featureName: string,
  commentPrefix: string
): string {
  const escaped = escapeRegex(commentPrefix);
  const escapedFeature = escapeRegex(featureName);

  // Remove the opening marker line
  const openRegex = new RegExp(
    `^[ \\t]*${escaped}\\s*@feature:${escapedFeature}\\s*\\n`,
    "gm"
  );
  content = content.replace(openRegex, "");

  // Remove the closing marker line
  const closeRegex = new RegExp(
    `^[ \\t]*${escaped}\\s*@end:${escapedFeature}\\s*\\n?`,
    "gm"
  );
  content = content.replace(closeRegex, "");

  return content;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
