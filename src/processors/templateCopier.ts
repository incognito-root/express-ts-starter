import path from "node:path";
import { fileURLToPath } from "node:url";

import fs from "fs-extra";

import { FEATURES } from "../features.js";
import type { FeatureName } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, "..", "template");

/**
 * Copy the template directory to the target, excluding files
 * belonging to disabled features.
 */
export async function copyTemplate(
  targetDir: string,
  disabledFeatures: FeatureName[]
): Promise<void> {
  // Build a set of paths to exclude
  const excludePaths = new Set<string>();
  for (const featureName of disabledFeatures) {
    const feature = FEATURES.find((f) => f.name === featureName);
    if (feature) {
      for (const p of feature.includePaths) {
        excludePaths.add(p);
      }
    }
  }

  await fs.copy(TEMPLATE_DIR, targetDir, {
    filter: (src: string) => {
      const relative = path.relative(TEMPLATE_DIR, src);
      if (!relative) return true; // root dir

      // Check if the relative path starts with any excluded path
      for (const excluded of excludePaths) {
        const normalizedExcluded = excluded.replace(/\/$/, "");
        if (
          relative === normalizedExcluded ||
          relative.startsWith(normalizedExcluded + path.sep)
        ) {
          return false;
        }
      }

      // Skip node_modules, dist, generated, .env
      const base = path.basename(src);
      if (
        base === "node_modules" ||
        base === "dist" ||
        base === ".env" ||
        (base === "generated" && relative === "generated")
      ) {
        return false;
      }

      return true;
    },
  });
}
