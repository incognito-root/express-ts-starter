import * as p from "@clack/prompts";
import pc from "picocolors";

import { FEATURES } from "./features.js";
import { PRESETS } from "./presets.js";
import type { FeatureName } from "./types.js";

export interface PromptResult {
  projectName: string;
  features: FeatureName[];
  productionUrl: string;
  dbName: string;
  initGit: boolean;
  installDeps: boolean;
}

export async function runPrompts(
  projectName?: string
): Promise<PromptResult> {
  p.intro(pc.bgCyan(pc.black(" create-express-ts-starter ")));

  if (!projectName) {
    const nameResult = await p.text({
      message: "Project name:",
      placeholder: "my-app",
      validate: (val) => {
        if (!val) return "Project name is required";
        if (!/^[a-zA-Z0-9._-]+$/.test(val))
          return "Only letters, numbers, dots, dashes, and underscores";
        return undefined;
      },
    });
    if (p.isCancel(nameResult)) process.exit(0);
    projectName = nameResult;
  }

  const presetResult = await p.select({
    message: "Choose a preset:",
    options: [
      {
        value: "minimal",
        label: `${pc.bold("Minimal")} — ${PRESETS.minimal.description}`,
      },
      {
        value: "recommended",
        label: `${pc.bold("Recommended")} — ${PRESETS.recommended.description}`,
      },
      {
        value: "full",
        label: `${pc.bold("Full")} — ${PRESETS.full.description}`,
      },
      {
        value: "custom",
        label: `${pc.bold("Custom")} — Pick your features`,
      },
    ],
  });
  if (p.isCancel(presetResult)) process.exit(0);

  let features: FeatureName[];

  if (presetResult === "custom") {
    const featureResult = await p.multiselect({
      message: "Select features to include:",
      options: FEATURES.map((f) => ({
        value: f.name,
        label: f.label,
        hint: f.description,
      })),
      required: false,
    });
    if (p.isCancel(featureResult)) process.exit(0);
    features = featureResult as FeatureName[];
  } else {
    features = PRESETS[presetResult as string].features;
  }

  const productionUrl = await p.text({
    message: "Production API URL:",
    placeholder: "https://api.example.com",
    defaultValue: "https://api.example.com",
  });
  if (p.isCancel(productionUrl)) process.exit(0);

  const dbName = await p.text({
    message: "Database name:",
    placeholder: `${projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_db`,
    defaultValue: `${projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_db`,
  });
  if (p.isCancel(dbName)) process.exit(0);

  const initGit = await p.confirm({
    message: "Initialize a git repository?",
    initialValue: true,
  });
  if (p.isCancel(initGit)) process.exit(0);

  const installDeps = await p.confirm({
    message: "Install dependencies?",
    initialValue: true,
  });
  if (p.isCancel(installDeps)) process.exit(0);

  return {
    projectName,
    features,
    productionUrl: productionUrl as string,
    dbName: dbName as string,
    initGit,
    installDeps,
  };
}
