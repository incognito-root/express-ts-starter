import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const templateDir = path.join(repoRoot, "template");
const templatePkg = path.join(templateDir, "package.json");
const templateLock = path.join(templateDir, "package-lock.json");
const templatePkgTemplate = path.join(templateDir, "_package.json");

if (!existsSync(templatePkgTemplate)) {
  console.error("Missing template/_package.json");
  process.exit(1);
}

const packageJsonAlreadyPresent = existsSync(templatePkg);
const packageLockAlreadyPresent = existsSync(templateLock);
const createdTempPackageJson = !packageJsonAlreadyPresent;

const cleanupTempPackageJson = () => {
  if (createdTempPackageJson && existsSync(templatePkg)) {
    rmSync(templatePkg);
  }
  if (createdTempPackageJson && !packageLockAlreadyPresent && existsSync(templateLock)) {
    rmSync(templateLock);
  }
};

if (createdTempPackageJson) {
  copyFileSync(templatePkgTemplate, templatePkg);
}

process.on("SIGINT", () => {
  cleanupTempPackageJson();
  process.exit(130);
});

process.on("SIGTERM", () => {
  cleanupTempPackageJson();
  process.exit(143);
});

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, {
    cwd: templateDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (typeof result.status === "number") {
    return result.status;
  }

  return 1;
};

const runAllowFail = (cmd, args) =>
  spawnSync(cmd, args, {
    cwd: templateDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

let exitCode = 0;
let infraStarted = false;

try {
  exitCode = run("npm", ["install"]);
  if (exitCode === 0) {
    exitCode = run("npm", ["run", "prisma:generate"]);
  }
  if (exitCode === 0) {
    exitCode = run("npm", ["run", "docker:test:up"]);
    if (exitCode === 0) {
      infraStarted = true;
      exitCode = run("npm", ["run", "test:all"]);
    }
  }
} finally {
  if (infraStarted) {
    runAllowFail("npm", ["run", "docker:test:down"]);
  }
  cleanupTempPackageJson();
}

process.exit(exitCode);
