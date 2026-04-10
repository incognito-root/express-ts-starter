import path from "node:path";
import fs from "node:fs/promises";

import type { FeatureName } from "../types.js";

/**
 * Strip feature-gated sections from _env.example (using # @feature / # @end markers),
 * then rename to .env.example.
 */
export async function buildEnv(
  projectDir: string,
  disabledFeatures: FeatureName[],
  enabledFeatures: FeatureName[]
): Promise<void> {
  const tmplPath = path.join(projectDir, "_env.example");
  const outPath = path.join(projectDir, ".env.example");

  let content: string;
  try {
    content = await fs.readFile(tmplPath, "utf-8");
  } catch {
    return; // no env template
  }

  // Strip disabled feature blocks
  for (const feature of disabledFeatures) {
    content = stripEnvBlock(content, feature);
    content = unwrapEnvBlock(content, `!${feature}`);
  }

  // Strip negation blocks of enabled features, unwrap normal blocks
  for (const feature of enabledFeatures) {
    content = stripEnvBlock(content, `!${feature}`);
    content = unwrapEnvBlock(content, feature);
  }

  // Clean up triple+ blank lines
  content = content.replace(/\n{3,}/g, "\n\n");

  await fs.writeFile(outPath, content, "utf-8");
  await fs.unlink(tmplPath);
}

function stripEnvBlock(content: string, featureName: string): string {
  const escaped = escapeRegex(featureName);
  const regex = new RegExp(
    `^[ \\t]*#\\s*@feature:${escaped}\\s*\\n[\\s\\S]*?^[ \\t]*#\\s*@end:${escaped}\\s*\\n?`,
    "gm"
  );
  return content.replace(regex, "");
}

function unwrapEnvBlock(content: string, featureName: string): string {
  const escaped = escapeRegex(featureName);
  const openRegex = new RegExp(
    `^[ \\t]*#\\s*@feature:${escaped}\\s*\\n`,
    "gm"
  );
  const closeRegex = new RegExp(
    `^[ \\t]*#\\s*@end:${escaped}\\s*\\n?`,
    "gm"
  );
  content = content.replace(openRegex, "");
  content = content.replace(closeRegex, "");
  return content;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
