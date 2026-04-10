import path from "node:path";
import fs from "node:fs/promises";

import { FEATURES } from "../features.js";
import type { FeatureName } from "../types.js";

/**
 * Read _package.json, remove dependencies and scripts for disabled features,
 * write it as package.json.
 */
export async function buildPackageJson(
  projectDir: string,
  disabledFeatures: FeatureName[]
): Promise<void> {
  const tmplPath = path.join(projectDir, "_package.json");
  const outPath = path.join(projectDir, "package.json");

  const raw = await fs.readFile(tmplPath, "utf-8");
  const pkg = JSON.parse(raw) as Record<string, unknown>;

  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;

  for (const featureName of disabledFeatures) {
    const feature = FEATURES.find((f) => f.name === featureName);
    if (!feature) continue;

    // Remove feature dependencies
    if (feature.dependencies) {
      for (const dep of Object.keys(feature.dependencies)) {
        delete deps[dep];
      }
    }

    // Remove feature devDependencies
    if (feature.devDependencies) {
      for (const dep of Object.keys(feature.devDependencies)) {
        delete devDeps[dep];
      }
    }

    // Remove feature scripts
    if (feature.removeScripts) {
      for (const script of feature.removeScripts) {
        delete scripts[script];
      }
    }
  }

  pkg.dependencies = deps;
  pkg.devDependencies = devDeps;
  pkg.scripts = scripts;

  await fs.writeFile(outPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  await fs.unlink(tmplPath);
}
