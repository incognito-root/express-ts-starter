#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";

import { Command } from "commander";

import { generate } from "./generator.js";
import { runPrompts } from "./prompts.js";
import { PRESETS } from "./presets.js";
import type { FeatureName } from "./types.js";

const program = new Command();

program
  .name("create-express-ts-starter")
  .description(
    "Scaffold a production-ready Express + TypeScript project with customizable features"
  )
  .argument("[project-name]", "Name of the project to create")
  .option(
    "--preset <name>",
    "Use a preset (minimal, recommended, full)"
  )
  .option("--yes", "Skip all prompts and use defaults", false)
  .option("--no-git", "Skip git initialization")
  .option("--no-install", "Skip npm install")
  .action(
    async (
      projectNameArg: string | undefined,
      opts: {
        preset?: string;
        yes: boolean;
        git: boolean;
        install: boolean;
      }
    ) => {
      try {
        let projectName: string;
        let features: FeatureName[];
        let productionUrl: string;
        let dbName: string;
        let initGit: boolean;
        let installDeps: boolean;

        if (opts.yes || opts.preset) {
          // Non-interactive mode
          projectName = projectNameArg || "my-app";
          const presetName = opts.preset || "recommended";
          const preset = PRESETS[presetName];
          if (!preset) {
            console.error(
              `Unknown preset: ${presetName}. Available: ${Object.keys(PRESETS).join(", ")}`
            );
            process.exit(1);
          }
          features = preset.features;
          productionUrl = "https://api.example.com";
          dbName = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_db`;
          initGit = opts.git;
          installDeps = opts.install;
        } else {
          // Interactive mode
          const result = await runPrompts(projectNameArg);
          projectName = result.projectName;
          features = result.features;
          productionUrl = result.productionUrl;
          dbName = result.dbName;
          initGit = result.initGit;
          installDeps = result.installDeps;
        }

        const projectDir = path.resolve(process.cwd(), projectName);

        if (fs.existsSync(projectDir)) {
          console.error(
            `Directory "${projectName}" already exists. Choose a different name.`
          );
          process.exit(1);
        }

        await generate({
          projectName,
          projectDir,
          features,
          productionUrl,
          dbName,
          initGit,
          installDeps,
        });
      } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    }
  );

program.parse();
